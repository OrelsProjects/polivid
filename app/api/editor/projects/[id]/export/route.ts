import { z } from "zod";
import { auth } from "@/auth";
import { exportProjectFromInput } from "@/lib/editor/export";
import { rememberProjectExport } from "@/lib/editor/projects";

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RememberSchema = z.object({
  videoId: z.string().regex(ID),
  version: z.number().int().min(1),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to export this edit." }, { status: 401 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const remembered = RememberSchema.safeParse(body);
  if (remembered.success) {
    const mark = await rememberProjectExport(userId, id, remembered.data.videoId, remembered.data.version);
    if (!mark) return Response.json({ error: "Not found." }, { status: 404 });
    return Response.json(mark);
  }
  const result = await exportProjectFromInput(userId, id);
  if ("error" in result && result.error === "Not found.") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }
  if ("error" in result) return Response.json({ error: result.error }, { status: 500 });
  return Response.json({ jobId: result.jobId, resumed: result.resumed }, { status: result.resumed ? 200 : 202 });
}
