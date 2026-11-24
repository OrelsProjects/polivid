import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";
import type { Focus } from "@/lib/editor/schema";
import type { LayoutBeat } from "./beats";
import type { BeatPlan } from "./rules";
import { SKETCH_KINDS } from "./sketch";
import { LAYOUT_NAMES, type LayoutMedia, type LayoutStyle } from "./styles";
import { DEFAULT_FACE } from "./timeline";

/** Layout planning stays on Opus, like picture planning. */
const PLAN_MODEL = "anthropic/claude-opus-5.5";

const PlanSchema = z.object({
  beats: z.array(
    z.object({
      layout: z.enum(LAYOUT_NAMES),
      upload: z.number().int().nullable(),
      picture: z.string().nullable(),
      highlight: z.string().nullable(),
      stat: z.string().nullable(),
      sketch: z
        .object({
          headline: z.string(),
          kind: z.enum(SKETCH_KINDS),
          items: z.array(z.object({ label: z.string(), value: z.string().nullable() })),
        })
        .nullable(),
    }),
  ),
});

const STYLE_NOTES: Record<string, string> = {
  "split-presenter":
    "split puts a picture in the top half and the speaker in the bottom half. avatar-close is a close-up of the speaker: use it for the hook (first line), punch lines, and the call to action (last line), about a fifth of the time. card shows an uploaded post or screenshot whole: use it when the line cites that post. Every split line gets its own new picture.",
  "punch-in":
    "avatar shows the speaker; avatar-close is a tighter cut of the same take. Alternate them at sentence starts. picture is a one- or two-second cutaway when the line names a concrete thing.",
  "source-reader":
    "bubble shows the uploaded post or article full-frame with the speaker in a small round bubble, while it is quoted or read. avatar shows the speaker for their own take on it.",
  "framed-post": "framed is the only layout: the speaker in a band with the captions under it.",
  "screen-demo":
    "avatar-close is the hook. window shows the uploaded screen recording or screenshot in a rounded window, for every line that walks through it.",
  "sketch-explainer":
    "sketch is the only layout: a hand-drawn page on paper, no person on camera. For each line also return sketch: a headline of about two words taken from the line, and one simple drawing that explains it. kind number shows one figure (one item with value); bars compares two to four figures (items with values); steps shows two to four short steps in order (items with labels only); compare sets two things side by side (two items with labels); words is the headline alone. A value must be a number said in that line, written the same way. Never make up, round, or combine numbers. Labels are one to three words. For other styles return sketch: null.",
};

/**
 * The planner's suggestion for each beat. It is only a suggestion: `enforcePlan` checks every
 * field against the style, the uploads, and the script. Without the planner, every beat gets
 * the style's default and the rules fill in the rest.
 */
export const suggestLayoutPlan = async (input: {
  style: LayoutStyle;
  beats: readonly LayoutBeat[];
  media: readonly LayoutMedia[];
  topic: string;
}): Promise<Partial<BeatPlan>[]> => {
  const fallback = input.beats.map(() => ({}));
  if (input.beats.length === 0 || !hasOpenRouterKey()) return fallback;
  const uploads = input.media.length
    ? input.media.map((item, index) => `${index}. ${item.role} (${item.kind})${item.note ? `: ${item.note}` : ""}`).join("\n")
    : "None.";
  try {
    const result = await generateText({
      model: openrouter().chat(PLAN_MODEL),
      instructions: `You edit a short vertical video. The speech is already recorded and cut into ${input.beats.length} numbered lines. For each line, in order, choose how the screen looks while it is said.

Layouts you may use: ${input.style.layouts.join(", ")}. ${STYLE_NOTES[input.style.id] ?? ""}

For each line return:
- layout: one of the layouts above.
- upload: the number of an upload to show on this line, or null. Only use an upload where it fits, and each upload once.
- picture: when the layout shows a picture and no upload, one or two sentences saying what is in the frame: subject, place, light, framing. Show the idea of the line, not its words. Never ask for text, letters, numbers, logos, or charts. Never name a real person. Otherwise null.
- highlight: one word from that line worth stressing, copied exactly, or null.
- stat: a short figure from that line, such as "43% never reach 10", only when the line itself says the number. Never make up or round a number. Otherwise null.
- sketch: only for the sketch layout, as described above. Otherwise null.`,
      prompt: `What the video is about:\n${input.topic.trim().slice(0, 1200)}\n\nUploads:\n${uploads}\n\nLines:\n${input.beats
        .map((beat, index) => `${index + 1}. (${(beat.end - beat.start).toFixed(1)}s) ${beat.say}`)
        .join("\n")}`,
      output: Output.object({ schema: PlanSchema, name: "layout_plan" }),
    });
    const beats = result.output.beats;
    if (beats.length !== input.beats.length) return fallback;
    return beats.map((beat) => ({
      layout: beat.layout,
      upload: beat.upload ?? undefined,
      picture: beat.picture ?? undefined,
      highlight: beat.highlight ?? undefined,
      stat: beat.stat ?? undefined,
      sketch: beat.sketch
        ? { headline: beat.sketch.headline, kind: beat.sketch.kind, items: beat.sketch.items.map((item) => ({ label: item.label, value: item.value ?? undefined })) }
        : undefined,
    }));
  } catch (error) {
    console.error("Could not plan the layouts. Using the style's defaults.", error);
    return fallback;
  }
};

const FaceSchema = z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) });

/**
 * Where the speaker's face is in a frame of the take, in percent, so crops and close-ups keep it
 * in view. Falls back to a little above centre, where a talking head usually sits.
 */
export const findFace = async (frame: Uint8Array, mime = "image/jpeg"): Promise<Focus> => {
  if (!hasOpenRouterKey()) return DEFAULT_FACE;
  try {
    const result = await generateText({
      model: openrouter().chat(PLAN_MODEL),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Find the centre of the main person's face in this frame: the point between the eyes and the mouth. Return x and y in percent of the frame width and height, from the top-left corner.",
            },
            { type: "image", image: frame, mediaType: mime },
          ],
        },
      ],
      output: Output.object({ schema: FaceSchema, name: "face" }),
    });
    return { x: Math.round(result.output.x), y: Math.round(result.output.y) };
  } catch (error) {
    console.error("Could not find the face in the take. Using the default focus.", error);
    return DEFAULT_FACE;
  }
};
