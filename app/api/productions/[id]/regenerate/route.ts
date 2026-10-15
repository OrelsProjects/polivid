import { auth } from "@/auth";
import { InsufficientCreditsError, insufficientCreditsResponse } from "@/lib/billing/errors";
import { regenerateGenerationCharged } from "@/lib/billing/production";
import { tickProductionJobs } from "@/lib/production/jobs/runner";
import { getProductionForUser } from "@/lib/production/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const production = await getProductionForUser(userId, id);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  if (production.status !== "ready") {
    return Response.json({ error: "This production is not ready to regenerate." }, { status: 409 });
  }
  try {
    const created = await regenerateGenerationCharged(id, userId);
    void tickProductionJobs();
    return Response.json({ ok: true, id: created.id });
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCreditsResponse(error);
    console.error("Could not regenerate production", error);
    return Response.json({ error: "Couldn't regenerate this video." }, { status: 500 });
  }
}
