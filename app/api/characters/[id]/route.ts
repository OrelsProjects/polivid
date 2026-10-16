import { auth } from "@/auth";
import { readCharacterForm, sampleFiles } from "@/lib/characters/form";
import { deleteCharacter, updateCharacter } from "@/lib/characters/store";

export const maxDuration = 60;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to edit a character." }, { status: 401 });
  const { id } = await context.params;
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Send the character as form data." }, { status: 400 });
  const parsed = readCharacterForm(form);
  if (parsed.voiceMode === "recorded" && !parsed.keepVoice && parsed.consent !== "yes") {
    return Response.json({ error: "Confirm this is your own voice." }, { status: 400 });
  }
  try {
    const files = parsed.voiceMode === "recorded" && !parsed.keepVoice ? await sampleFiles(parsed.samples) : [];
    const character = await updateCharacter(userId, id, { ...parsed, files });
    if (!character) return Response.json({ error: "That character was not found." }, { status: 404 });
    return Response.json({ character });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't update that character.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to delete a character." }, { status: 401 });
  const { id } = await context.params;
  const removed = await deleteCharacter(userId, id);
  if (!removed) return Response.json({ error: "That character was not found." }, { status: 404 });
  return Response.json({ ok: true });
}
