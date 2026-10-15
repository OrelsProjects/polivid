import { z } from "zod";
import { auth } from "@/auth";
import { requireCredits } from "@/lib/billing/credits";
import { InsufficientCreditsError, insufficientCreditsResponse } from "@/lib/billing/errors";
import { ndjsonResponse } from "@/lib/http/ndjson";
import { startPlanning } from "@/lib/production/jobs/coordinator";
import { tickProductionJobs } from "@/lib/production/jobs/runner";
import { plannerProvider } from "@/lib/production/planner";
import { labelForPlanningStep } from "@/lib/production/progress";
import { PRODUCTION_MODES } from "@/lib/production/schema";
import { ownedReferenceKeys, referenceAttachments } from "@/lib/production/references";
import { createProductionForUser, listProductionsForUser, updateProduction } from "@/lib/production/store";
import type { ProductionStreamEvent } from "@/lib/production/stream";
import { MAX_REFERENCE_IMAGES, VIDEO_FORMATS as FORMATS } from "@/lib/video/schema";

export const maxDuration = 300;

const CreateSchema = z.object({
  text: z.string().trim().min(3).max(20_000),
  format: z.enum(FORMATS).optional().default("9:16"),
  durationSec: z.number().int().min(5).max(180).optional().default(30),
  mode: z.enum(PRODUCTION_MODES).optional().default("review"),
  creativeDelegation: z.boolean().optional().default(false),
  budgetUsd: z.number().positive().max(500).optional(),
  referenceKeys: z.array(z.string().min(1)).max(MAX_REFERENCE_IMAGES).optional().default([]),
});

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see productions." }, { status: 401 });
  const productions = await listProductionsForUser(userId);
  return Response.json({ productions });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to start a production." }, { status: 401 });
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }
  const budgetUsd = parsed.data.budgetUsd ?? Number(process.env.PRODUCTION_DEFAULT_BUDGET_USD ?? "15");
  const referenceKeys = ownedReferenceKeys(userId, parsed.data.referenceKeys);
  if (referenceKeys.length !== new Set(parsed.data.referenceKeys).size) {
    return Response.json({ error: "Use pictures from your own library as references." }, { status: 400 });
  }
  try {
    await requireCredits(userId, 1);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCreditsResponse(error);
    throw error;
  }
  return ndjsonResponse(async (send) => {
    let id: string | undefined;
    const emit = (event: ProductionStreamEvent) => send(event);
    try {
      id = await createProductionForUser(userId, {
        text: parsed.data.text,
        format: parsed.data.format,
        durationSec: parsed.data.durationSec,
        mode: parsed.data.mode,
        creativeDelegation: parsed.data.creativeDelegation,
        plannerProvider: plannerProvider(),
        budgetUsd,
        attachments: referenceAttachments(referenceKeys),
      });
      emit({
        type: "created",
        id,
        key: "save",
        label: labelForPlanningStep("save"),
        state: "done",
      });
      const result = await startPlanning(id, userId, {
        onProgress: (event) => emit({ type: "progress", ...event }),
      });
      void tickProductionJobs();
      emit({ type: "done", id, status: result.status });
    } catch (error) {
      console.error("Could not start production", error);
      if (id) {
        await updateProduction(id, { status: "failed", error: "Couldn't start that production." }).catch(() => undefined);
      }
      emit({ type: "error", error: "Couldn't start that production.", id });
    }
  }, 201);
}
