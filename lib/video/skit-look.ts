import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";

const LOOK_MODEL = "anthropic/claude-haiku-5.5";

const PictureKind = z.object({ kind: z.enum(["photo", "drawn"]) });

/**
 * Whether a character's picture is already drawn (a cartoon, illustration, 3D render, mascot) or a
 * photo of a real person. A skit draws a photo in its default look and leaves a drawing alone.
 * When it can't tell, it says drawn, so the character is filmed as it is rather than redrawn.
 */
export const isDrawnPicture = async (dataUrl: string) => {
  if (!hasOpenRouterKey()) return true;
  try {
    const result = await generateText({
      model: openrouter().chat(LOOK_MODEL),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Is this picture a photo of a real person or scene, or is it drawn: a cartoon, illustration, painting, 3D render, mascot, or similar? Answer photo or drawn.",
            },
            { type: "image", image: dataUrl },
          ],
        },
      ],
      output: Output.object({ schema: PictureKind, name: "picture" }),
    });
    return result.output.kind === "drawn";
  } catch (error) {
    console.error("Could not tell whether a character picture is drawn.", error);
    return true;
  }
};
