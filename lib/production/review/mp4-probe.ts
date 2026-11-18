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

/** Parses a moov box's bytes. Null when it holds no movie header. */
export const probeMoov = (moov: Buffer): MediaProbe | null => {
  const root: Box = { type: "moov", start: 0, end: moov.length };
  const mvhd = child(moov, root, "mvhd");
  if (!mvhd || mvhd.end - mvhd.start < 20) return null;
  const v1 = moov[mvhd.start] === 1;
  const timescale = moov.readUInt32BE(mvhd.start + (v1 ? 20 : 12));
  const duration = v1 ? Number(moov.readBigUInt64BE(mvhd.start + 24)) : moov.readUInt32BE(mvhd.start + 16);
  const durationSec = timescale > 0 ? duration / timescale : 0;

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

/** Probes an MP4 or MOV file from its header. Null when it is not one, or its header can't be read. */
export const probeMp4File = async (filePath: string): Promise<MediaProbe | null> => {
  const file = await open(filePath, "r");
  try {
    const { size } = await file.stat();
    const header = Buffer.alloc(16);
    let at = 0;
    let first = true;
    while (at + 8 <= size) {
      const { bytesRead } = await file.read(header, 0, 16, at);
      if (bytesRead < 8) return null;
      let boxSize = header.readUInt32BE(0);
      const type = header.toString("latin1", 4, 8);
      if (first && type !== "ftyp" && type !== "moov" && type !== "wide" && type !== "free" && type !== "mdat") return null;
      first = false;
      let headerSize = 8;
      if (boxSize === 1) {
        if (bytesRead < 16) return null;
        boxSize = Number(header.readBigUInt64BE(8));
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = size - at;
      }
      if (boxSize < headerSize) return null;
      if (type === "moov") {
        const length = Math.min(boxSize, size - at) - headerSize;
        if (length <= 0 || length > MAX_MOOV_BYTES) return null;
        const moov = Buffer.alloc(length);
        await file.read(moov, 0, length, at + headerSize);
        return probeMoov(moov);
      }
      at += boxSize;
    }
    return null;
  } finally {
    await file.close();
  }
};
