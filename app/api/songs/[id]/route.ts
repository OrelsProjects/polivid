import { auth } from "@/auth";
import { readSongDraft, songDraftAudioKey } from "@/lib/music/song-draft";
import { videoMediaResponse } from "@/lib/video/media-store";

/** Streams a song take the signed-in user made. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in to hear this song.", { status: 401 });
  const draft = await readSongDraft(userId, id);
  if (!draft) return new Response("Not found.", { status: 404 });
  const response = await videoMediaResponse(songDraftAudioKey(id), "audio/mpeg", request.headers.get("range"));
  return response ?? new Response("Not found.", { status: 404 });
}
