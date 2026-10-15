import { auth } from "@/auth";
import { db } from "@/lib/db";
import { rangedFileResponse } from "@/lib/http/range";
import { footagePath, hasFootage } from "@/lib/video/footage";

/** Streams the filmed mp4 for a video the signed-in user owns. Honors Range so the editor can seek. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to watch this video.", { status: 401 });
  if (!hasFootage(id)) return new Response("This video has no filmed clip.", { status: 404 });

  const row = await db.video.findFirst({ where: { id, userId }, select: { id: true } });
  if (!row) return new Response("Not found.", { status: 404 });

  return rangedFileResponse(footagePath(id), "video/mp4", request.headers.get("range"));
}
