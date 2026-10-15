import { generateText, Output, type ModelMessage, type UserContent } from "ai";
import { z } from "zod";
import { openrouter } from "@/lib/ai/openrouter";
import { ReviewRecordSchema } from "../schema";
import type { AdapterJob, AdapterRequest, MediaAdapter } from "./types";

const FindingOutput = z.object({
  passed: z.boolean(),
  findings: ReviewRecordSchema.shape.findings,
  observation: z.object({
    completedActions: z.array(z.string()),
    incompleteActions: z.array(z.string()),
    deviations: z.array(z.string()),
    boundaryOut: z.object({
      position: z.string(),
      direction: z.string(),
      speed: z.string(),
      gaze: z.string(),
      camera: z.string(),
      props: z.array(z.string()),
      incompleteAction: z.string().nullable(),
    }),
    lastFrameDescription: z.string(),
  }),
});

const INSTRUCTIONS = `You review generated video against a shot plan.
You are shown sampled frames in time order and then the EXACT FINAL FRAME of the clip. Describe only what is visible in those images. Never fill gaps from the plan; when the footage differs from the plan, record the difference under deviations.
Scores are advisory. Return findings with timestamps, evidence, severity, and a proposed repair, plus an observation of what actually happened at the outgoing edit point.
boundaryOut must describe the final frame as shot: where the subject is, which way they face and move, how fast, where they look, the camera framing, and the props in frame.
lastFrameDescription is the handoff for the next clip, which will start from this very frame. Write one dense, literal paragraph that would let another model rebuild it: shot size, camera angle and height, lens feel; where each person sits in the frame and how much of them is visible; body pose, head direction and gaze; what each hand is doing; wardrobe with garments, colors and textures; every visible prop and its exact position; the room or background elements and where they sit; light sources, direction, color and mood; and the state of motion at the cut. Name colors precisely. Do not mention the plan or the previous shot.
If no frames are attached, say so in deviations and return an empty lastFrameDescription.`;

const reviewMessages = (request: AdapterRequest): ModelMessage[] => {
  const content: UserContent = [{ type: "text", text: request.prompt }];
  for (const frame of request.frames ?? []) {
    content.push({ type: "text", text: `Frame at ${frame.timeSec.toFixed(2)}s:` });
    content.push({ type: "image", image: frame.bytes, mediaType: frame.mime });
  }
  const last = request.refs?.find((ref) => ref.role === "last_frame" && ref.bytes);
  if (last?.bytes) {
    content.push({ type: "text", text: "EXACT FINAL FRAME of the clip. The next clip begins from this image:" });
    content.push({ type: "image", image: last.bytes, mediaType: last.mime ?? "image/png" });
  }
  return [{ role: "user", content }];
};

export const createReviewAdapter = (): MediaAdapter => ({
  id: "review",
  estimate: () => 0.02,
  submit: async (request, idempotencyKey) => {
    const model = request.modelId.includes("argon") ? "google/gemini-4-argon" : "google/gemini-3.8-flash";
    const result = await generateText({
      model: openrouter().chat(model),
      instructions: INSTRUCTIONS,
      messages: reviewMessages(request),
      output: Output.object({ schema: FindingOutput, name: "review" }),
    });
    return {
      providerJobId: idempotencyKey,
      status: "completed",
      outputs: [{ mime: "application/json", json: result.output }],
      usage: { usd: 0.02, units: { tokens: result.usage?.outputTokens ?? 0 } },
    } satisfies AdapterJob;
  },
  poll: async (id) => ({ providerJobId: id, status: "completed", outputs: [], usage: { usd: 0, units: {} } }),
  collect: async (id) => ({ providerJobId: id, status: "completed", outputs: [], usage: { usd: 0, units: {} } }),
});
