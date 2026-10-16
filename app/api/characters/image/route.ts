import { z } from "zod";
import { auth } from "@/auth";
import { InsufficientCreditsError, insufficientCreditsResponse } from "@/lib/billing/errors";
import { generateCharacterImage } from "@/lib/characters/generate-image";
import { MAX_IMAGE_PROMPT } from "@/lib/characters/constants";
import { spendCharacterCredit } from "@/lib/characters/spend";

export const maxDuration = 60;

const Schema = z.object({
  prompt: z.string().trim().min(8).max(MAX_IMAGE_PROMPT),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to generate a picture." }, { status: 401 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Describe the person in a few words." }, { status: 400 });
  try {
    const spend = await spendCharacterCredit(userId, "character_image");
    try {
      const image = await generateCharacterImage(userId, parsed.data.prompt);
      return Response.json(image);
    } catch (error) {
      await spend.refund().catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCreditsResponse(error);
    const message = error instanceof Error ? error.message : "Couldn't generate that picture.";
    return Response.json({ error: message }, { status: 400 });
  }
}
