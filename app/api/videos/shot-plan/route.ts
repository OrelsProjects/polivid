import { auth } from "@/auth";
import { PlanShotsError, planShotsFromInput } from "@/lib/video/plan-shots";

export const maxDuration = 60;

/** Plans the cuts for a lyrics or prompt video and prices them. Nothing is filmed or charged yet. */
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
