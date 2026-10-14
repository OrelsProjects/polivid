import { readFile } from "node:fs/promises";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { footagePath, hasFootage } from "@/lib/video/footage";

/** Streams the filmed mp4 for a video the signed-in user owns. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to watch this video.", { status: 401 });
  if (!hasFootage(id)) return new Response("This video has no filmed clip.", { status: 404 });

  const row = await db.video.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return new Response("Not found.", { status: 404 });

  const bytes = await readFile(footagePath(id));
  return new Response(bytes, {
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
