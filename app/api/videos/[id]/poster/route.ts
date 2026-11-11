import { auth } from "@/auth";
import { db } from "@/lib/db";
import { hasFootage } from "@/lib/video/footage";
import { extractScrubFrames, readScrubFrame, SCRUB_FPS } from "@/lib/video/scrub-frames";

/** The still shown on a video card: about one second in, past any fade from black. */
const POSTER_INDEX = SCRUB_FPS;

/**
 * One still picture of a video, for cards and lists. A card that shows a picture
 * finishes loading and lets go of its connection. A card that shows a `<video>`
 * can hold one open, and a browser only allows a few to the same site.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to preview this video.", { status: 401 });

  const row = await db.video.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return new Response("Not found.", { status: 404 });

  // Stills are cut when a clip is saved, so the usual case is one read.
  let bytes = (await readScrubFrame(id, POSTER_INDEX)) ?? (await readScrubFrame(id, 0));
  if (!bytes) {
    if (!(await hasFootage(id))) return new Response("This video has no filmed clip.", { status: 404 });
    try {
      const meta = await extractScrubFrames(id);
      bytes = await readScrubFrame(id, Math.max(0, Math.min(POSTER_INDEX, meta.count - 1)));
    } catch {
      return new Response("Could not make a preview picture.", { status: 500 });
    }
  }
  if (!bytes) return new Response("Not found.", { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      // A retried video keeps its id, so the picture is rechecked now and then.
      "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
