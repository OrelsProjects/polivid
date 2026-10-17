import { auth } from "@/auth";
import { db } from "@/lib/db";
import { clipIndexFromParam } from "@/lib/video/clip-preview";
import { isVideoId, videoMediaResponse } from "@/lib/video/media-store";
import { segmentMediaKey } from "@/lib/video/segments";

/** Streams one finished shot from a video the signed-in user owns. */
export async function GET(request: Request, context: { params: Promise<{ id: string; index: string }> }) {
  const { id, index: rawIndex } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to watch this video.", { status: 401 });

  const index = clipIndexFromParam(rawIndex);
  if (!isVideoId(id) || index == null) return new Response("Not found.", { status: 404 });

  const job = await db.videoJob.findFirst({ where: { id, userId }, select: { id: true } });
  if (!job) return new Response("Not found.", { status: 404 });

  const response = await videoMediaResponse(segmentMediaKey(id, index), "video/mp4", request.headers.get("range"));
  return response ?? new Response("This shot is not ready yet.", { status: 404 });
}
