import { auth } from "@/auth";
import { ensureThreadProject } from "@/lib/coach/project";

export async function POST(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to open this project." }, { status: 401 });
  const { threadId } = await context.params;
  const project = await ensureThreadProject(userId, threadId);
  if (!project) return Response.json({ error: "The video is not ready yet." }, { status: 409 });
  return Response.json(project);
}
