import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";

/** Picture planning stays on Opus. POLIVID_MODEL does not change this call. */
const PICTURE_MODEL = "anthropic/claude-opus-5.5";

const PicturesSchema = z.object({
  pictures: z.array(z.string().min(1)),
});

/** Used when the planner is unavailable. A note from the script, or else the spoken line, is still a workable brief. */
export const fallbackPictures = (says: readonly string[], notes: readonly string[] = []) =>
  says.map((say, index) => {
    const note = notes[index]?.trim();
    return note
      ? `A clear, well-composed picture of: ${note}`
      : `A clear, well-composed picture that illustrates this line: ${say.trim()}`;
  });

/**
 * One picture brief per spoken beat. The briefs describe what is in frame, not the words,
 * and reuse the same description for a person or place that comes back.
 * A note the person wrote for a line decides what that line's picture shows.
 */
export const describeStills = async (input: {
  topic: string;
  says: readonly string[];
  /** What the person asked each picture to show. Empty entries are left to the planner. */
  notes?: readonly string[];
}): Promise<string[]> => {
  if (input.says.length === 0) return [];
  const notes = input.says.map((_, index) => (input.notes?.[index] ?? "").trim().slice(0, 300));
  if (!hasOpenRouterKey()) return fallbackPictures(input.says, notes);
  const directed = notes.some(Boolean);
  try {
    const result = await generateText({
      model: openrouter().chat(PICTURE_MODEL),
      instructions: `You plan the pictures for a narrated video. You get the narration cut into ${input.says.length} numbered lines. Return exactly ${input.says.length} picture briefs, in order, one per line. Each brief is one or two sentences saying what is in the frame: the subject, the place, the light, and the framing. Show the idea of the line, not its words. When the same person, object, or place appears again, describe it the same way so the pictures match.${
        directed
          ? " Some lines end with a note from the writer in the form (Picture note: …). That note says what the picture for that line must show. Build the brief around it and do not replace its subject."
          : ""
      } Never ask for text, letters, numbers, captions, logos, or charts in the picture. Never name a real person. Do not number the briefs.`,
      prompt: `What the video is about:\n${input.topic.trim().slice(0, 1200)}\n\nNarration lines:\n${input.says
        .map((say, index) => `${index + 1}. ${say}${notes[index] ? ` (Picture note: ${notes[index]})` : ""}`)
        .join("\n")}`,
      output: Output.object({ schema: PicturesSchema, name: "pictures" }),
    });
    const pictures = result.output.pictures.map((picture) => picture.trim()).filter(Boolean);
    if (pictures.length === input.says.length) return pictures;
  } catch (error) {
    console.error("Could not plan the pictures. Using the narration as the briefs.", error);
  }
  return fallbackPictures(input.says, notes);
};
