import { auth } from "@/auth";
import { db } from "@/lib/db";
import { songMediaKey } from "@/lib/music/song";
import { isVideoId, videoMediaResponse } from "@/lib/video/media-store";

/** Streams the composed song for a lyrics video the signed-in user owns. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to hear this song.", { status: 401 });
  if (!isVideoId(id)) return new Response("Not found.", { status: 404 });

  const job = await db.videoJob.findFirst({ where: { id, userId }, select: { id: true } });
  if (!job) return new Response("Not found.", { status: 404 });

  const response = await videoMediaResponse(songMediaKey(id), "audio/mpeg", request.headers.get("range"));
  return response ?? new Response("This video has no song yet.", { status: 404 });
}
