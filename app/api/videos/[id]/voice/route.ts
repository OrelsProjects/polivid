import { auth } from "@/auth";
import { db } from "@/lib/db";
import { voiceMediaKey } from "@/lib/video/footage";
import { isVideoId, videoMediaResponse } from "@/lib/video/media-store";

/** Streams the character voice stored beside a video the signed-in user owns. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to hear this voice.", { status: 401 });
  if (!isVideoId(id)) return new Response("Not found.", { status: 404 });

  const row = await db.video.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return new Response("Not found.", { status: 404 });

  const response = await videoMediaResponse(voiceMediaKey(id), "audio/mpeg", request.headers.get("range"));
  return response ?? new Response("This video has no voice.", { status: 404 });
}
