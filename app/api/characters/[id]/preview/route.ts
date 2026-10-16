import { auth } from "@/auth";
import { PREVIEW_LINE, resolveCharacterVoice, speakText } from "@/lib/voice/speak";

export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to hear a character." }, { status: 401 });
  const { id } = await context.params;
  try {
    const voice = await resolveCharacterVoice(userId, id);
    if (!voice) return Response.json({ error: "This character has no voice yet." }, { status: 400 });
    const bytes = await speakText({ text: PREVIEW_LINE, voiceId: voice.providerVoiceId, cloned: voice.cloned });
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't play that voice.";
    return Response.json({ error: message }, { status: 400 });
  }
}
