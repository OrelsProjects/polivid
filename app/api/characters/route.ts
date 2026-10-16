import { auth } from "@/auth";
import { readCharacterForm, sampleFiles } from "@/lib/characters/form";
import { createCharacter, listCharacters } from "@/lib/characters/store";

export const maxDuration = 60;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see your characters." }, { status: 401 });
  const characters = await listCharacters(userId);
  return Response.json({ characters });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to save a character." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Send the character as form data." }, { status: 400 });
  const parsed = readCharacterForm(form);
  if (parsed.voiceMode === "recorded" && parsed.consent !== "yes") {
    return Response.json({ error: "Confirm this is your own voice." }, { status: 400 });
  }
  try {
    const files = parsed.voiceMode === "recorded" ? await sampleFiles(parsed.samples) : [];
    const character = await createCharacter(userId, { ...parsed, files });
    return Response.json({ character }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't save that character.";
    return Response.json({ error: message }, { status: 400 });
  }
}
