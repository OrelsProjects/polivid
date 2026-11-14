import { CharacterLibraryError, voiceFromClipAudio } from "@/lib/characters/library";
import { characterRoute } from "@/lib/characters/route-helpers";

export const maxDuration = 60;

/** Form: one to three "samples" (audio taken from the character's clips) and consent=yes. */
export const POST = characterRoute(async (userId, { id }, request) => {
  const form = await request.formData().catch(() => null);
  if (!form) throw new CharacterLibraryError("Send the clip audio as form data.");
  if (form.get("consent") !== "yes") throw new CharacterLibraryError("Confirm this is your own voice.");
  const samples = form.getAll("samples").filter((entry): entry is File => entry instanceof File);
  const files = await Promise.all(
    samples.map(async (file) => ({ bytes: new Uint8Array(await file.arrayBuffer()), type: file.type, name: file.name })),
  );
  const character = await voiceFromClipAudio(userId, id, files);
  return Response.json({ character });
});
