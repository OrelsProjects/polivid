import { z } from "zod";
import { auth } from "@/auth";
import { polishPresetFragment } from "@/lib/ai/polish-preset";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { MAX_PRESET_FRAGMENT } from "@/lib/video/presets";

const PolishSchema = z.object({
  description: z.string().trim().min(8).max(MAX_PRESET_FRAGMENT),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Sign in to polish a preset." }, { status: 401 });
  if (!hasOpenRouterKey()) return Response.json({ error: "Add an API key to polish presets." }, { status: 400 });
  const parsed = PolishSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Describe the look first." }, { status: 400 });
  try {
    const fragment = await polishPresetFragment(parsed.data.description);
    return Response.json({ fragment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't polish that.";
    return Response.json({ error: message }, { status: 500 });
  }
}
