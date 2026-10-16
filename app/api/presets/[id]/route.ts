import { auth } from "@/auth";
import { deleteCustomPreset } from "@/lib/video/custom-presets";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to delete a preset." }, { status: 401 });
  const { id } = await context.params;
  const removed = await deleteCustomPreset(userId, id);
  if (!removed) return Response.json({ error: "That preset was not found." }, { status: 404 });
  return Response.json({ ok: true });
}
