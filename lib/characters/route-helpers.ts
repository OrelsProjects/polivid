import "server-only";
import { auth } from "@/auth";
import { VoiceServiceError } from "@/lib/production/adapters/elevenlabs";
import { CharacterLibraryError } from "./library";

type Params = Promise<Record<string, string>>;

/** Signed-in user, the route params, and a uniform error shape for the character library routes. */
export const characterRoute =
  (run: (userId: string, params: Record<string, string>, request: Request) => Promise<Response>) =>
  async (request: Request, context: { params: Params }) => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return Response.json({ error: "Sign in to edit characters." }, { status: 401 });
    try {
      return await run(userId, await context.params, request);
    } catch (error) {
      if (error instanceof CharacterLibraryError || error instanceof VoiceServiceError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      console.error("Character library request failed", error);
      return Response.json({ error: "Couldn't update that character." }, { status: 500 });
    }
  };

export const jsonBody = async (request: Request) =>
  ((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>;
