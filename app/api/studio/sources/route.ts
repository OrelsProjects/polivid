import { auth } from "@/auth";
import { CreateVideoError, queueVideoFromInput } from "@/lib/video/create-request";
import { InsufficientCreditsError, insufficientCreditsResponse } from "@/lib/billing/errors";
import { ConceptError, suggestConcepts } from "@/lib/studio/concepts";
import { createSource, getSource, listSources, saveSourceConcepts } from "@/lib/studio/sources";

const userIdFrom = async () => {
  const session = await auth();
  return session?.user?.id ?? null;
};

export async function GET() {
  const userId = await userIdFrom();
  if (!userId) return Response.json({ error: "Sign in to see your sources." }, { status: 401 });
  const sources = await listSources(userId);
  return Response.json({ sources });
}

export async function POST(request: Request) {
  const userId = await userIdFrom();
  if (!userId) return Response.json({ error: "Sign in to save a source." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { title?: string; body?: string } | null;
  const text = body?.body?.trim() ?? "";
  if (!text) return Response.json({ error: "Paste some writing first." }, { status: 400 });
  const source = await createSource(userId, { title: body?.title ?? "", body: text });
  return Response.json({ source }, { status: 201 });
}

export async function suggestForSource(id: string) {
  const userId = await userIdFrom();
  if (!userId) return Response.json({ error: "Sign in to suggest concepts." }, { status: 401 });
  const source = await getSource(userId, id);
  if (!source) return Response.json({ error: "That source is not in your library." }, { status: 404 });
  try {
    const fresh = await suggestConcepts(source.body);
    const kept = source.concepts.filter((concept) => concept.videoId);
    const saved = await saveSourceConcepts(userId, id, [...kept, ...fresh]);
    return Response.json({ source: saved });
  } catch (error) {
    if (error instanceof ConceptError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Could not suggest concepts", error);
    return Response.json({ error: "Couldn't suggest concepts. Try again." }, { status: 500 });
  }
}

export async function queueSourceVideos(id: string, conceptIds: string[]) {
  const userId = await userIdFrom();
  if (!userId) return Response.json({ error: "Sign in to make a video." }, { status: 401 });
  const source = await getSource(userId, id);
  if (!source) return Response.json({ error: "That source is not in your library." }, { status: 404 });
  const chosen = source.concepts.filter((concept) => conceptIds.includes(concept.id) && !concept.videoId);
  if (chosen.length === 0) return Response.json({ error: "Select a concept that does not already have a video." }, { status: 400 });

  try {
    for (const concept of chosen) {
      const { jobId } = await queueVideoFromInput(userId, {
        prompt: concept.script || concept.title,
        format: "9:16",
        length: 30,
        mode: "motion-graphics",
        tier: "pro",
      });
      concept.videoId = jobId;
    }
    const saved = await saveSourceConcepts(userId, id, source.concepts);
    return Response.json({ source: saved, jobIds: chosen.map((concept) => concept.videoId) }, { status: 202 });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCreditsResponse(error);
    if (error instanceof CreateVideoError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Could not queue source videos", error);
    return Response.json({ error: "Couldn't start those videos. Try again." }, { status: 500 });
  }
}
