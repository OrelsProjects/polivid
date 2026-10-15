import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasFootage } from "@/lib/video/footage";
import { extractScrubFrames, readScrubMeta, scrubFramePath } from "@/lib/video/scrub-frames";

/** One still from the scrub strip. Used while dragging the playhead. */
export async function GET(_request: Request, context: { params: Promise<{ id: string; index: string }> }) {
  const { id, index: rawIndex } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to preview this video.", { status: 401 });
  if (!hasFootage(id)) return new Response("This video has no filmed clip.", { status: 404 });

  const row = await db.video.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return new Response("Not found.", { status: 404 });

  let meta = await readScrubMeta(id);
  if (!meta) {
    try {
      meta = await extractScrubFrames(id);
    } catch {
      return new Response("Could not build a scrub preview.", { status: 500 });
    }
  }

  const index = Math.min(meta.count - 1, Math.max(0, Number.parseInt(rawIndex, 10) || 0));
  const file = scrubFramePath(id, index);
  if (!existsSync(file)) return new Response("Not found.", { status: 404 });
  const bytes = await readFile(file);
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
