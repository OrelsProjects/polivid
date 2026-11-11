import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasFootage } from "@/lib/video/footage";
import { extractScrubFrames, readScrubFrame, readScrubMeta } from "@/lib/video/scrub-frames";

/** One still from the scrub strip. Used while dragging the playhead. */
export async function GET(_request: Request, context: { params: Promise<{ id: string; index: string }> }) {
  const { id, index: rawIndex } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to preview this video.", { status: 401 });

  const row = await db.video.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return new Response("Not found.", { status: 404 });
  // The editor asks for frames it already knows exist, so the usual case is one read.
  const asked = Math.max(0, Number.parseInt(rawIndex, 10) || 0);
  let bytes = await readScrubFrame(id, asked);
  if (!bytes) {
    if (!(await hasFootage(id))) return new Response("This video has no filmed clip.", { status: 404 });
    let meta = await readScrubMeta(id);
    if (!meta) {
      try {
        meta = await extractScrubFrames(id);
      } catch {
        return new Response("Could not build a scrub preview.", { status: 500 });
      }
    }
    bytes = await readScrubFrame(id, Math.min(meta.count - 1, asked));
  }
  if (!bytes) return new Response("Not found.", { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
