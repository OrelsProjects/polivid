import { z } from "zod";
import { auth } from "@/auth";
import { restoreProductionVersion } from "@/lib/production/restore";

const Schema = z.object({ versionId: z.string().min(1) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a version." }, { status: 400 });
  const result = await restoreProductionVersion(userId, id, parsed.data.versionId);
  if ("error" in result) {
    const message = result.error === "Production not found." ? "Not found." : result.error;
    return Response.json({ error: message }, { status: 404 });
  }
  return Response.json({ ok: true });
}
