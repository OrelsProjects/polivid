import { z } from "zod";
import { auth } from "@/auth";
import {
  createBlankProjectForUser,
  createProjectFromVideoForUser,
  listProjectsForUser,
} from "@/lib/editor/projects";
import { VIDEO_FORMATS } from "@/lib/video/schema";

const CreateSchema = z.object({
  videoId: z.string().uuid().optional(),
  format: z.enum(VIDEO_FORMATS).optional(),
});

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see your edits." }, { status: 401 });
  const projects = await listProjectsForUser(userId);
  return Response.json({ projects });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to start an edit." }, { status: 401 });

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    if (parsed.data.videoId) {
      const project = await createProjectFromVideoForUser(userId, parsed.data.videoId);
      if (!project) return Response.json({ error: "That video is not ready to edit." }, { status: 404 });
      return Response.json(project, { status: 201 });
    }
    const project = await createBlankProjectForUser(userId, parsed.data.format ?? "9:16");
    return Response.json(project, { status: 201 });
  } catch (error) {
    console.error("Could not create an edit project", error);
    return Response.json({ error: "Couldn't start that edit. Try again." }, { status: 500 });
  }
}
