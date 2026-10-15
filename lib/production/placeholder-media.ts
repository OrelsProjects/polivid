import { readFileSync } from "node:fs";
import path from "node:path";

const FTYP = Buffer.from("ftyp");
const PLACEHOLDER_MP4 = readFileSync(path.join(process.cwd(), "lib/production/fixtures/placeholder.mp4"));

export const hasFtyp = (bytes: Uint8Array) => {
  const head = Buffer.from(bytes.subarray(0, 32));
  return head.includes(FTYP);
};

export const isFakeMp4 = (bytes: Uint8Array) => bytes.byteLength === 1200 && !hasFtyp(bytes);

export const isSilentMockWav = (bytes: Uint8Array) => {
  if (bytes.byteLength < 44) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  const wave = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!);
  if (riff !== "RIFF" || wave !== "WAVE") return false;
  const sampleRate = view.getUint32(24, true);
  if (sampleRate !== 8000) return false;
  for (let i = 44; i + 1 < bytes.byteLength; i += 2) {
    if (view.getInt16(i, true) !== 0) return false;
  }
  return true;
};

export const toneWav = (durationSec: number, frequencyHz = 440) => {
  const sampleRate = 22050;
  const samples = Math.max(1, Math.round(sampleRate * Math.max(0.2, durationSec)));
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
  };
  write(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  write(8, "WAVE");
  write(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i += 1) {
    const sample = Math.round(Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate) * 8000);
    view.setInt16(44 + i * 2, sample, true);
  }
  return bytes;
};

export const mockWavDurationSec = (bytes: Uint8Array) => {
  if (bytes.byteLength < 44) return 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sampleRate = view.getUint32(24, true) || 8000;
  const dataBytes = Math.max(0, bytes.byteLength - 44);
  return Math.max(0.2, dataBytes / (sampleRate * 2));
};

const toneForId = (id: string) => 220 + (id.charCodeAt(0) % 6) * 110;

export const playablePlaceholderMp4 = async () => new Uint8Array(PLACEHOLDER_MP4);

export const healProductionMedia = async (
  kind: string,
  bytes: Uint8Array,
  contentType: string,
  id: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> => {
  if (kind === "video" && isFakeMp4(bytes)) {
    return { bytes: await playablePlaceholderMp4(), contentType: "video/mp4" };
  }
  if (kind === "audio" && isSilentMockWav(bytes)) {
    return { bytes: toneWav(mockWavDurationSec(bytes), toneForId(id)), contentType: "audio/wav" };
  }
  void contentType;
  return null;
};
