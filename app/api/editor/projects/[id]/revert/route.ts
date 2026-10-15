import { auth } from "@/auth";
import { revertProjectForUser } from "@/lib/editor/projects";

const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to revert this edit." }, { status: 401 });
  const { id } = await context.params;
  if (!PROJECT_ID.test(id)) return Response.json({ error: "Not found." }, { status: 404 });

  const project = await revertProjectForUser(userId, id);
  if (!project) {
    return Response.json({ error: "This edit has no original video to restore." }, { status: 400 });
  }
  return Response.json(project);
}
