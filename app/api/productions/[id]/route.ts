import { z } from "zod";
import { auth } from "@/auth";
import { getProductionForUser, putEntity } from "@/lib/production/store";
import { tickProductionJobs } from "@/lib/production/jobs/runner";
import { ENTITY_KINDS, parseEntityData, type EntityKind } from "@/lib/production/schema";

const PatchSchema = z.object({
  kind: z.enum(ENTITY_KINDS),
  stableKey: z.string().min(1),
  data: z.unknown(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to see this production." }, { status: 401 });
  const { id } = await context.params;
  const production = await getProductionForUser(userId, id);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  void tickProductionJobs();
  return Response.json({ production });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in to edit this production." }, { status: 401 });
  const { id } = await context.params;
  const production = await getProductionForUser(userId, id);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const kind = parsed.data.kind as EntityKind;
  const data = parseEntityData(kind, parsed.data.data);
  await putEntity(id, kind, parsed.data.stableKey, data, "user");
  const updated = await getProductionForUser(userId, id);
  return Response.json({ production: updated });
}
