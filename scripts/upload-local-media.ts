/**
 * Copies clips, scrub stills and waveforms from data/media/ to S3 under videos/,
 * so videos filmed on this machine also play on the deployed app.
 * Files already in the bucket are skipped.
 *
 *   npm run media:upload
 *   npm run media:upload -- --dry-run
 *
 * Needs AWS_S3_BUCKET and the app's AWS keys in .env or .env.local.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { hasS3Config, listObjectKeys, putUpload } from "@/lib/storage/s3";
import { VIDEO_MEDIA_PREFIX } from "@/lib/video/media-store";

const LOCAL_DIR = path.join(process.cwd(), "data", "media");
const UPLOAD_BATCH = 16;
const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".jpg": "image/jpeg",
  ".json": "application/json",
};

const listFiles = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(full);
      return Promise.resolve(entry.isFile() && CONTENT_TYPES[path.extname(entry.name)] ? [full] : []);
    }),
  );
  return nested.flat();
};

async function main() {
  if (!hasS3Config()) throw new Error("S3 is not configured. Set AWS_S3_BUCKET and the app's AWS keys.");
  const dryRun = process.argv.includes("--dry-run");
  const stored = new Set(await listObjectKeys(VIDEO_MEDIA_PREFIX));
  const local = (await listFiles(LOCAL_DIR)).map((file) => ({
    file,
    key: `${VIDEO_MEDIA_PREFIX}${path.relative(LOCAL_DIR, file).split(path.sep).join("/")}`,
  }));
  const pending = local.filter(({ key }) => !stored.has(key));

  for (const { key } of pending) {
    if (key.endsWith(".mp4")) console.log(`${dryRun ? "Would upload" : "Uploading"} ${key}`);
  }
  if (!dryRun) {
    for (let start = 0; start < pending.length; start += UPLOAD_BATCH) {
      await Promise.all(
        pending.slice(start, start + UPLOAD_BATCH).map(async ({ file, key }) => {
          await putUpload(key, new Uint8Array(await readFile(file)), CONTENT_TYPES[path.extname(file)]);
        }),
      );
    }
  }

  console.log(`\n${dryRun ? "Would upload" : "Uploaded"} ${pending.length} files. ${local.length - pending.length} were already in S3.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
