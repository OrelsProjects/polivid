import { auth } from "@/auth";
import { spokenWordsForVideo } from "@/lib/editor/caption-speech";
import { getProjectForUser } from "@/lib/editor/projects";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The words said in the video this edit was made from, each with its time in seconds, so the
 * editor can lay captions over them. Nothing is changed on the server: the editor adds the
 * captions to its own copy of the timeline, which saves like any other change.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const userId = (await auth())?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  if (!ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });
  const project = await getProjectForUser(userId, id);
  if (!project) return Response.json({ error: "Not found." }, { status: 404 });
  if (!project.sourceVideoId) {
    return Response.json({ error: "Captions are made from the video this edit started from, and this edit has none." }, { status: 400 });
  }
  try {
    const words = await spokenWordsForVideo(userId, project.sourceVideoId);
    if (words.length === 0) return Response.json({ error: "No speech was found in this video." }, { status: 422 });
    return Response.json({ words });
  } catch (error) {
    console.error("Could not time the words for captions", error);
    return Response.json({ error: "Couldn't listen to this video. Try again." }, { status: 500 });
  }
}
