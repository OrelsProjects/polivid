import { open } from "node:fs/promises";
import type { MediaProbe } from "./ffmpeg";

/**
 * Reads duration, size, and tracks from an MP4 or MOV header, with no ffprobe.
 * Servers without ffmpeg (Vercel) use it to check an upload before a job is queued.
 * It reads only the box headers and the `moov` box, wherever it sits in the file.
 * Frame rate is not read; the worker, which has ffprobe, measures that.
 */

interface Box {
  type: string;
  /** Where the box's contents start, after its header. */
  start: number;
  /** Where the box ends. */
  end: number;
}

/** The moov box is a few hundred KB even for long videos. Anything bigger is not a header we trust. */
const MAX_MOOV_BYTES = 64 * 1024 * 1024;

const boxesIn = (data: Buffer, from: number, to: number): Box[] => {
  const boxes: Box[] = [];
  let at = from;
  while (at + 8 <= to) {
    let size = data.readUInt32BE(at);
    const type = data.toString("latin1", at + 4, at + 8);
    let header = 8;
    if (size === 1) {
      if (at + 16 > to) break;
      size = Number(data.readBigUInt64BE(at + 8));
      header = 16;
    } else if (size === 0) {
      size = to - at;
    }
    if (size < header || at + size > to) break;
    boxes.push({ type, start: at + header, end: at + size });
    at += size;
  }
  return boxes;
};

const child = (data: Buffer, parent: Box, type: string) => boxesIn(data, parent.start, parent.end).find((box) => box.type === type);

const fixed16 = (data: Buffer, at: number) => data.readUInt32BE(at) / 65536;

/** A version 0 box keeps times in 32 bits, version 1 in 64. */
const readTime = (data: Buffer, at: number, wide: boolean) => (wide ? Number(data.readBigUInt64BE(at)) : data.readUInt32BE(at));

interface TrackClock {
  id: number;
  timescale: number;
  /** trex's default sample duration, used when a fragment names none. */
  defaultDuration: number;
}

/** Each track's id and timescale from moov, with defaults from mvex/trex. */
const trackClocks = (moov: Buffer, root: Box): Map<number, TrackClock> => {
  const clocks = new Map<number, TrackClock>();
  for (const trak of boxesIn(moov, root.start, root.end).filter((box) => box.type === "trak")) {
    const tkhd = child(moov, trak, "tkhd");
    const mdia = child(moov, trak, "mdia");
    const mdhd = mdia && child(moov, mdia, "mdhd");
    if (!tkhd || !mdhd) continue;
    const id = moov.readUInt32BE(tkhd.start + (moov[tkhd.start] === 1 ? 20 : 12));
    const timescale = moov.readUInt32BE(mdhd.start + (moov[mdhd.start] === 1 ? 20 : 12));
    clocks.set(id, { id, timescale, defaultDuration: 0 });
  }
  const mvex = child(moov, root, "mvex");
  for (const trex of mvex ? boxesIn(moov, mvex.start, mvex.end).filter((box) => box.type === "trex") : []) {
    if (trex.end - trex.start < 16) continue;
    const clock = clocks.get(moov.readUInt32BE(trex.start + 4));
    if (clock) clock.defaultDuration = moov.readUInt32BE(trex.start + 12);
  }
  return clocks;
};

/**
 * The length of a fragmented MP4 (screen recordings, some phone and web exports), whose moov says 0.
 * Each fragment's track runs end at its decode time plus its samples' durations; the longest track wins.
 */
const fragmentedSeconds = (moofs: readonly Buffer[], clocks: Map<number, TrackClock>) => {
  const ends = new Map<number, number>();
  for (const moof of moofs) {
    for (const traf of boxesIn(moof, 0, moof.length).filter((box) => box.type === "traf")) {
      const tfhd = child(moof, traf, "tfhd");
      if (!tfhd || tfhd.end - tfhd.start < 8) continue;
      const tfhdFlags = moof.readUInt32BE(tfhd.start) & 0xffffff;
      const trackId = moof.readUInt32BE(tfhd.start + 4);
      const clock = clocks.get(trackId);
      if (!clock) continue;
      let at = tfhd.start + 8;
      if (tfhdFlags & 0x01) at += 8;
      if (tfhdFlags & 0x02) at += 4;
      const defaultDuration = tfhdFlags & 0x08 ? moof.readUInt32BE(at) : clock.defaultDuration;
      const tfdt = child(moof, traf, "tfdt");
      let time = tfdt ? readTime(moof, tfdt.start + 4, moof[tfdt.start] === 1) : (ends.get(trackId) ?? 0);
      for (const trun of boxesIn(moof, traf.start, traf.end).filter((box) => box.type === "trun")) {
        const flags = moof.readUInt32BE(trun.start) & 0xffffff;
        const count = moof.readUInt32BE(trun.start + 4);
        let sampleAt = trun.start + 8 + (flags & 0x01 ? 4 : 0) + (flags & 0x04 ? 4 : 0);
        const sampleBytes = [0x100, 0x200, 0x400, 0x800].filter((bit) => flags & bit).length * 4;
        for (let index = 0; index < count; index += 1) {
          if (flags & 0x100) {
            if (sampleAt + 4 > trun.end) break;
            time += moof.readUInt32BE(sampleAt);
          } else {
            time += defaultDuration;
          }
          sampleAt += sampleBytes;
        }
      }
      ends.set(trackId, Math.max(ends.get(trackId) ?? 0, time));
    }
  }
  let seconds = 0;
  for (const [trackId, end] of ends) {
    const timescale = clocks.get(trackId)?.timescale ?? 0;
    if (timescale > 0) seconds = Math.max(seconds, end / timescale);
  }
  return seconds;
};

/**
 * Parses a moov box's bytes. Null when it holds no movie header. `moofs` are the file's fragment headers,
 * used for the length when moov leaves it at 0.
 */
export const probeMoov = (moov: Buffer, moofs: readonly Buffer[] = []): MediaProbe | null => {
  const root: Box = { type: "moov", start: 0, end: moov.length };
  const mvhd = child(moov, root, "mvhd");
  if (!mvhd || mvhd.end - mvhd.start < 20) return null;
  const v1 = moov[mvhd.start] === 1;
  const timescale = moov.readUInt32BE(mvhd.start + (v1 ? 20 : 12));
  const duration = readTime(moov, mvhd.start + (v1 ? 24 : 16), v1);
  let durationSec = timescale > 0 ? duration / timescale : 0;
  if (durationSec === 0) {
    // A fragmented file may say its full length in mvex/mehd, in the movie timescale.
    const mvex = child(moov, root, "mvex");
    const mehd = mvex && child(moov, mvex, "mehd");
    if (mehd && timescale > 0) durationSec = readTime(moov, mehd.start + 4, moov[mehd.start] === 1) / timescale;
  }
  if (durationSec === 0 && moofs.length > 0) durationSec = fragmentedSeconds(moofs, trackClocks(moov, root));

  let width: number | null = null;
  let height: number | null = null;
  let codec: string | null = null;
  let audioCodec: string | null = null;
  let hasVideo = false;
  let hasAudio = false;
  for (const trak of boxesIn(moov, root.start, root.end).filter((box) => box.type === "trak")) {
    const mdia = child(moov, trak, "mdia");
    const hdlr = mdia && child(moov, mdia, "hdlr");
    if (!mdia || !hdlr || hdlr.end - hdlr.start < 12) continue;
    const handler = moov.toString("latin1", hdlr.start + 8, hdlr.start + 12);
    const minf = child(moov, mdia, "minf");
    const stbl = minf && child(moov, minf, "stbl");
    const stsd = stbl && child(moov, stbl, "stsd");
    const sampleType = stsd && stsd.end - stsd.start >= 16 ? moov.toString("latin1", stsd.start + 12, stsd.start + 16).trim() : null;
    if (handler === "vide" && !hasVideo) {
      hasVideo = true;
      codec = sampleType;
      const tkhd = child(moov, trak, "tkhd");
      if (tkhd) {
        const tv1 = moov[tkhd.start] === 1;
        // Width and height are the last two 16.16 fields: after the 36-byte matrix.
        const sizeAt = tkhd.start + (tv1 ? 88 : 76);
        if (sizeAt + 8 <= tkhd.end) {
          width = Math.round(fixed16(moov, sizeAt)) || null;
          height = Math.round(fixed16(moov, sizeAt + 4)) || null;
        }
      }
    } else if (handler === "soun" && !hasAudio) {
      hasAudio = true;
      audioCodec = sampleType;
    }
  }
  return { durationSec, width, height, fps: null, hasAudio, hasVideo, codec: codec ?? audioCodec };
};

/** Fragment headers are small; a bigger one is not something we trust. */
const MAX_MOOF_BYTES = 4 * 1024 * 1024;

/** Probes an MP4 or MOV file from its header. Null when it is not one, or its header can't be read. */
export const probeMp4File = async (filePath: string): Promise<MediaProbe | null> => {
  const file = await open(filePath, "r");
  try {
    const { size } = await file.stat();
    const header = Buffer.alloc(16);
    let moov: Buffer | null = null;
    const moofs: Buffer[] = [];
    let at = 0;
    let first = true;
    while (at + 8 <= size) {
      const { bytesRead } = await file.read(header, 0, 16, at);
      if (bytesRead < 8) break;
      let boxSize = header.readUInt32BE(0);
      const type = header.toString("latin1", 4, 8);
      if (first && type !== "ftyp" && type !== "moov" && type !== "wide" && type !== "free" && type !== "mdat") return null;
      first = false;
      let headerSize = 8;
      if (boxSize === 1) {
        if (bytesRead < 16) break;
        boxSize = Number(header.readBigUInt64BE(8));
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = size - at;
      }
      if (boxSize < headerSize) break;
      const length = Math.min(boxSize, size - at) - headerSize;
      if (type === "moov") {
        if (length <= 0 || length > MAX_MOOV_BYTES) return null;
        moov = Buffer.alloc(length);
        await file.read(moov, 0, length, at + headerSize);
      } else if (type === "moof" && length > 0 && length <= MAX_MOOF_BYTES) {
        const moof = Buffer.alloc(length);
        await file.read(moof, 0, length, at + headerSize);
        moofs.push(moof);
      }
      at += boxSize;
    }
    return moov ? probeMoov(moov, moofs) : null;
  } finally {
    await file.close();
  }
};
