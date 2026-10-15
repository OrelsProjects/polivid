import { auth } from "@/auth";
import { InsufficientCreditsError, insufficientCreditsResponse } from "@/lib/billing/errors";
import { approveGenerationCharged } from "@/lib/billing/production";
import { tickProductionJobs } from "@/lib/production/jobs/runner";
import { getProductionForUser } from "@/lib/production/store";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const production = await getProductionForUser(userId, id);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  if (production.status !== "preview") {
    return Response.json({ error: "This production is not waiting for approval." }, { status: 409 });
  }
  try {
    await approveGenerationCharged(id, userId);
  } catch (error) {
    if (error instanceof InsufficientCreditsError) return insufficientCreditsResponse(error);
    throw error;
  }
  void tickProductionJobs();
  return Response.json({ ok: true });
}
