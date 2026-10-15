import "server-only";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { overwriteProductionBytes, readProductionBytes } from "./assets";
import { healProductionMedia } from "./placeholder-media";
import { probeFile } from "./review/ffmpeg";

const execFileAsync = promisify(execFile);

const TILE = 96;
const MIN_INTERVAL = 0.5;
/** JPEG width tops out at 65535px, so long videos get sparser frames. */
const MAX_FRAMES = 400;

export interface FilmstripMeta {
  /** Seconds between frames. Frame i shows time i * interval. */
  interval: number;
  count: number;
  tile: number;
}

export interface Filmstrip {
  bytes: Uint8Array;
  meta: FilmstripMeta;
}

const baseKey = (storageKey: string) => storageKey.replace(/\.[^./]+$/, "");
const imageKey = (storageKey: string) => `${baseKey(storageKey)}.filmstrip.jpg`;
const metaKey = (storageKey: string) => `${baseKey(storageKey)}.filmstrip.json`;

/** One horizontal JPEG of square frames, so the timeline needs one request per clip. */
export const buildFilmstrip = async (video: Uint8Array): Promise<Filmstrip> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-filmstrip-"));
  try {
    const input = path.join(dir, "input.mp4");
    const framesDir = path.join(dir, "frames");
    const output = path.join(dir, "filmstrip.jpg");
    await writeFile(input, video);
    await mkdir(framesDir);

    const { durationSec } = await probeFile(input);
    const interval = Math.max(MIN_INTERVAL, durationSec / MAX_FRAMES);
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-i",
        input,
        "-vf",
        `fps=1/${interval},scale=${TILE}:${TILE}:force_original_aspect_ratio=increase,crop=${TILE}:${TILE}`,
        "-q:v",
        "5",
        path.join(framesDir, "%04d.jpg"),
      ],
      { timeout: 60_000 },
    );
    const count = (await readdir(framesDir)).filter((name) => name.endsWith(".jpg")).length;
    if (count === 0) throw new Error("The video has no frames.");

    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", path.join(framesDir, "%04d.jpg"), "-vf", `tile=${count}x1`, "-frames:v", "1", "-q:v", "5", output],
      { timeout: 60_000 },
    );
    return { bytes: new Uint8Array(await readFile(output)), meta: { interval, count, tile: TILE } };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

export const saveFilmstrip = async (storageKey: string, video: Uint8Array) => {
  const filmstrip = await buildFilmstrip(video);
  await overwriteProductionBytes(imageKey(storageKey), filmstrip.bytes, "image/jpeg");
  await overwriteProductionBytes(
    metaKey(storageKey),
    new TextEncoder().encode(JSON.stringify(filmstrip.meta)),
    "application/json",
  );
  return filmstrip;
};

const readFilmstrip = async (storageKey: string): Promise<Filmstrip | null> => {
  try {
    const [image, meta] = await Promise.all([
      readProductionBytes(imageKey(storageKey)),
      readProductionBytes(metaKey(storageKey)),
    ]);
    return { bytes: image.bytes, meta: JSON.parse(new TextDecoder().decode(meta.bytes)) as FilmstripMeta };
  } catch {
    return null;
  }
};

const building = new Map<string, Promise<Filmstrip>>();

/** Clips saved before filmstrips existed get one on first view. */
export const loadFilmstrip = async (asset: { id: string; kind: string; storageKey: string }) => {
  const stored = await readFilmstrip(asset.storageKey);
  if (stored) return stored;

  const pending = building.get(asset.storageKey);
  if (pending) return pending;
  const task = (async () => {
    const { bytes, contentType } = await readProductionBytes(asset.storageKey);
    const healed = await healProductionMedia(asset.kind, bytes, contentType, asset.id);
    return saveFilmstrip(asset.storageKey, healed?.bytes ?? bytes);
  })().finally(() => {
    building.delete(asset.storageKey);
  });
  building.set(asset.storageKey, task);
  return task;
};
