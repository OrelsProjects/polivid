import { z } from "zod";
import { improveNarration } from "@/lib/ai/improve";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { auth } from "@/auth";

const ImproveSchema = z.object({
  description: z.string().trim().min(3).max(2000),
});

/** Turns the Create-page prompt into a spoken narration. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Sign in to improve a prompt." }, { status: 401 });
  }
  if (!hasOpenRouterKey()) {
    return Response.json({ error: "Add an API key to improve prompts." }, { status: 400 });
  }

  const parsed = ImproveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Write a few words first." }, { status: 400 });
  }

  try {
    const script = await improveNarration(parsed.data.description);
    return Response.json({ script });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't improve that.";
    return Response.json({ error: message }, { status: 500 });
  }
}
