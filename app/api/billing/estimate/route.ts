import { z } from "zod";
import { auth } from "@/auth";
import { videoJobCredits } from "@/lib/billing/estimate";
import { estimateProductionCredits } from "@/lib/billing/production";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { getProductionForUser } from "@/lib/production/store";
import { GENERATION_MODEL_IDS } from "@/lib/video/models";
import { VIDEO_MODE_IDS, VIDEO_TIERS } from "@/lib/video/modes";

const Schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("video"),
    length: z.number().int().min(1).max(180),
    model: z.enum(GENERATION_MODEL_IDS).optional(),
    mode: z.enum(VIDEO_MODE_IDS).optional(),
    tier: z.enum(VIDEO_TIERS).optional(),
    resolution: z.string().optional(),
  }),
  z.object({
    kind: z.literal("production"),
    productionId: z.string().min(1),
  }),
]);

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });

  if (parsed.data.kind === "video") {
    const credits = videoJobCredits({
      demo: !hasOpenRouterKey(),
      mode: parsed.data.mode,
      tier: parsed.data.tier,
      modelId: parsed.data.model,
      resolution: parsed.data.resolution,
      length: parsed.data.length,
    });
    return Response.json({ credits });
  }

  const production = await getProductionForUser(userId, parsed.data.productionId);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  const credits = await estimateProductionCredits(production.id);
  return Response.json({ credits });
}
