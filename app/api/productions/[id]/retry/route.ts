import { z } from "zod";
import { auth } from "@/auth";
import { resumeFromLastStep } from "@/lib/production/jobs/coordinator";
import { startProductionTicker, tickProductionJobs } from "@/lib/production/jobs/runner";
import { getProductionForUser, retryStep } from "@/lib/production/store";

const Schema = z.object({ stepId: z.string().min(1).optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const production = await getProductionForUser(userId, id);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  const parsed = Schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Couldn't retry that." }, { status: 400 });
  if (parsed.data.stepId) {
    const ok = await retryStep(id, parsed.data.stepId);
    if (!ok) return Response.json({ error: "That step cannot be retried." }, { status: 409 });
    startProductionTicker();
    await tickProductionJobs();
    return Response.json({ ok: true });
  }
  try {
    const result = await resumeFromLastStep(id, userId);
    startProductionTicker();
    await tickProductionJobs();
    return Response.json(result);
  } catch (error) {
    console.error("Could not retry production", error);
    return Response.json({ error: "Couldn't retry from the last step." }, { status: 500 });
  }
}
