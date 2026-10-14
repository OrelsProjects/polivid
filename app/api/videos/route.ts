import { z } from "zod";
import { auth } from "@/auth";
import { generateVideo } from "@/lib/video/generate";
import { GENERATION_MODEL_IDS, generationModelById } from "@/lib/video/models";
import { VIDEO_FORMATS, VIDEO_LENGTHS } from "@/lib/video/schema";

const CreateVideoSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  format: z.enum(VIDEO_FORMATS),
  length: z.union(VIDEO_LENGTHS.map((l) => z.literal(l))),
  model: z.enum(GENERATION_MODEL_IDS),
});

/** Video models can take a few minutes. Keep the request open while the job polls. */
export const maxDuration = 300;

export type GenerateEvent =
  | { type: "step"; step: string }
  | { type: "done"; id: string; status: "ready" | "failed"; error: string | null }
  | { type: "error"; message: string };

/**
 * Generates a video for the signed-in user and streams NDJSON progress
 * events: one {type:"step"} per pipeline stage, then a final {type:"done"}.
 * Consumed by components/generator.tsx.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to generate videos." }, { status: 401 });

  const parsed = CreateVideoSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: GenerateEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      try {
        const model = generationModelById(parsed.data.model);
        if (!model) {
          send({ type: "error", message: "Pick a generation model and try again." });
          controller.close();
          return;
        }
        const video = await generateVideo(
          userId,
          { prompt: parsed.data.prompt, format: parsed.data.format, length: parsed.data.length, model: model.slug },
          (step) => send({ type: "step", step }),
        );
        send({ type: "done", id: video.id, status: video.status, error: video.error });
      } catch (error) {
        // generateVideo saves its own failures; this only fires if saving itself fails.
        console.error("Video generation crashed", error);
        send({ type: "error", message: "Something went wrong saving the video. Try again." });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store" },
  });
}
