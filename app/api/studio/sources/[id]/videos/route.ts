import { queueSourceVideos } from "../../route";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { conceptIds?: string[] } | null;
  return queueSourceVideos(id, body?.conceptIds ?? []);
}
