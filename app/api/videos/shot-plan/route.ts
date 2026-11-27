import { auth } from "@/auth";
import { PlanShotsError, planShotsFromInput } from "@/lib/video/plan-shots";

// A skit's plan writes every shot in full, which can take a while for a long script.
export const maxDuration = 120;

/** Plans the cuts for a lyrics, prompt or skit video and prices them. Nothing is filmed or charged yet. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Sign in to plan a video." }, { status: 401 });
  try {
    const plan = await planShotsFromInput(await request.json().catch(() => null));
    return Response.json(plan);
  } catch (error) {
    if (error instanceof PlanShotsError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
