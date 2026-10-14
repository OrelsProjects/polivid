import { auth } from "@/auth";
import { getVideoJobForUser } from "@/lib/video/jobs";

const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Owner-only progress for one video job. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see this video." }, { status: 401 });
  if (!JOB_ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  const job = await getVideoJobForUser(userId, id);
  if (!job) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json(job);
}
