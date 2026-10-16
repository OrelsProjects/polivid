import { z } from "zod";
import { auth } from "@/auth";
import { createCustomPreset, listCustomPresets } from "@/lib/video/custom-presets";
import { MAX_PRESET_FRAGMENT, MAX_PRESET_NAME } from "@/lib/video/presets";

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(MAX_PRESET_NAME),
  promptFragment: z.string().trim().min(8).max(MAX_PRESET_FRAGMENT),
  negativeFragment: z.string().trim().max(MAX_PRESET_FRAGMENT).optional(),
});

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see your presets." }, { status: 401 });
  const presets = await listCustomPresets(userId);
  return Response.json({ presets });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to save a preset." }, { status: 401 });
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Give the preset a name and a look." }, { status: 400 });
  try {
    const preset = await createCustomPreset(userId, parsed.data);
    return Response.json({ preset }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't save that preset.";
    return Response.json({ error: message }, { status: 400 });
  }
}
