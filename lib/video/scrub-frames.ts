import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { withFootageFile } from "./footage";
import { assertVideoId, putVideoMedia, readVideoMedia } from "./media-store";

const execFileAsync = promisify(execFile);

export const SCRUB_FPS = 15;

export interface ScrubMeta {
  fps: number;
  count: number;
}

const frameName = (index: number) => `${String(index).padStart(3, "0")}.jpg`;
const scrubFrameKey = (id: string, index: number) => `scrub/${assertVideoId(id)}/${frameName(index)}`;
const scrubMetaKey = (id: string) => `scrub/${assertVideoId(id)}/meta.json`;

export const readScrubMeta = async (id: string): Promise<ScrubMeta | null> => {
  const bytes = await readVideoMedia(scrubMetaKey(id));
  return bytes ? (JSON.parse(Buffer.from(bytes).toString("utf8")) as ScrubMeta) : null;
};

export const readScrubFrame = (id: string, index: number) => readVideoMedia(scrubFrameKey(id, index));

/** Cuts stills from the clip and stores them. Pass `sourceFile` when a local copy is already at hand. */
export const extractScrubFrames = async (id: string, sourceFile?: string): Promise<ScrubMeta> => {
  if (!sourceFile) return withFootageFile(id, (file) => extractScrubFrames(id, file));
  const dir = await mkdtemp(path.join(os.tmpdir(), "polivid-scrub-"));
  try {
    await execFileAsync(
      "ffmpeg",
      ["-y", "-i", sourceFile, "-vf", `fps=${SCRUB_FPS},scale=540:-2`, "-start_number", "0", "-q:v", "5", path.join(dir, "%03d.jpg")],
      { timeout: 120_000 },
    );
    const count = (await readdir(dir)).filter((name) => name.endsWith(".jpg")).length;
    await Promise.all(
      Array.from({ length: count }, async (_, index) => {
        const bytes = new Uint8Array(await readFile(path.join(dir, frameName(index))));
        await putVideoMedia(scrubFrameKey(id, index), bytes, "image/jpeg");
      }),
    );
    const meta: ScrubMeta = { fps: SCRUB_FPS, count };
    await putVideoMedia(scrubMetaKey(id), new TextEncoder().encode(JSON.stringify(meta)), "application/json");
    return meta;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
};
