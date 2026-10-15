import "server-only";
import { execFile } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { footagePath } from "./footage";

const execFileAsync = promisify(execFile);

export const SCRUB_FPS = 15;

const VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MEDIA_DIR = path.join(process.cwd(), "data", "media");

export interface ScrubMeta {
  fps: number;
  count: number;
}

export const scrubDir = (id: string) => {
  if (!VIDEO_ID.test(id)) throw new Error("Invalid video id.");
  return path.join(MEDIA_DIR, "scrub", id);
};

export const scrubFramePath = (id: string, index: number) => {
  return path.join(scrubDir(id), `${String(index).padStart(3, "0")}.jpg`);
};

export const scrubMetaPath = (id: string) => path.join(scrubDir(id), "meta.json");

export const readScrubMeta = async (id: string): Promise<ScrubMeta | null> => {
  const file = scrubMetaPath(id);
  if (!existsSync(file)) return null;
  const { readFile } = await import("node:fs/promises");
  return JSON.parse(await readFile(file, "utf8")) as ScrubMeta;
};

export const extractScrubFrames = async (id: string) => {
  const source = footagePath(id);
  if (!existsSync(source)) throw new Error("This video has no filmed clip.");
  const dir = scrubDir(id);
  await mkdir(dir, { recursive: true });
  await execFileAsync(
    "ffmpeg",
    ["-y", "-i", source, "-vf", `fps=${SCRUB_FPS},scale=540:-2`, "-start_number", "0", "-q:v", "5", path.join(dir, "%03d.jpg")],
    { timeout: 120_000 },
  );
  const count = (await readdir(dir)).filter((name) => name.endsWith(".jpg")).length;
  const meta: ScrubMeta = { fps: SCRUB_FPS, count };
  await writeFile(scrubMetaPath(id), JSON.stringify(meta));
  return meta;
};
