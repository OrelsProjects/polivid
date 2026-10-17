import { auth } from "@/auth";
import { db } from "@/lib/db";
import { footageResponse } from "@/lib/video/footage";
import { isVideoId } from "@/lib/video/media-store";

const downloadFilename = (value: string | null) => {
  const cleaned = (value ?? "")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .replace(/\.mp4$/i, "");
  const name = cleaned || "edit";
  const ascii = name.replace(/[^\x20-\x7e]+/g, "").trim() || "edit";
  return { ascii: `${ascii}.mp4`, utf8: `${name}.mp4` };
};

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
  if (!response) return new Response("This video has no filmed clip.", { status: 404 });

  const url = new URL(request.url);
  if (url.searchParams.get("download") !== "1") return response;
  const filename = downloadFilename(url.searchParams.get("name"));
  const headers = new Headers(response.headers);
  headers.set(
    "Content-Disposition",
    `attachment; filename="${filename.ascii}"; filename*=UTF-8''${encodeURIComponent(filename.utf8)}`,
  );
  return new Response(response.body, { status: response.status, headers });
}
