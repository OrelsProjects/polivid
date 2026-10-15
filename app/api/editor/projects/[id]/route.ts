import { z } from "zod";
import { auth } from "@/auth";
import { deleteProjectForUser, getProjectForUser, ProjectConflictError, saveProjectForUser } from "@/lib/editor/projects";
import { TimelineSchema } from "@/lib/editor/schema";

const PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SaveSchema = z.object({
  title: z.string().trim().max(200),
  version: z.number().int().min(1),
  timeline: TimelineSchema,
});

const readId = async (context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  return PROJECT_ID.test(id) ? id : null;
};

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to open this edit." }, { status: 401 });
  const id = await readId(context);
  if (!id) return Response.json({ error: "Not found." }, { status: 404 });
  const project = await getProjectForUser(userId, id);
  if (!project) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json(project);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to save this edit." }, { status: 401 });
  const id = await readId(context);
  if (!id) return Response.json({ error: "Not found." }, { status: 404 });

  const parsed = SaveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const project = await saveProjectForUser(userId, id, parsed.data);
    return Response.json(project);
  } catch (error) {
    if (error instanceof ProjectConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === "Not found.") {
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    console.error("Could not save the edit project", error);
    return Response.json({ error: "Couldn't save this edit. Try again." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to delete this edit." }, { status: 401 });
  const id = await readId(context);
  if (!id) return Response.json({ error: "Not found." }, { status: 404 });
  const deleted = await deleteProjectForUser(userId, id);
  if (!deleted) return Response.json({ error: "Not found." }, { status: 404 });
  return new Response(null, { status: 204 });
}
