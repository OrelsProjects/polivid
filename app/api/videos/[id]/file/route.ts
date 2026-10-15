import { auth } from "@/auth";
import { db } from "@/lib/db";
import { footageResponse } from "@/lib/video/footage";
import { isVideoId } from "@/lib/video/media-store";

/** Streams the filmed mp4 for a video the signed-in user owns. Honors Range so the editor can seek. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to watch this video.", { status: 401 });
  if (!isVideoId(id)) return new Response("Not found.", { status: 404 });

  const row = await db.video.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return new Response("Not found.", { status: 404 });

  const response = await footageResponse(id, request.headers.get("range"));
  return response ?? new Response("This video has no filmed clip.", { status: 404 });
}
