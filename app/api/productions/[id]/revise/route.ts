import { z } from "zod";
import { auth } from "@/auth";
import { estimateInvalidation, invalidate } from "@/lib/production/revisions";
import { getProductionForUser, listDependencies, markVersionsStale } from "@/lib/production/store";

const Schema = z.object({
  versionIds: z.array(z.string().min(1)).min(1),
  confirm: z.boolean().optional().default(false),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const production = await getProductionForUser(userId, id);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick what changed." }, { status: 400 });
  const edges = (await listDependencies(id)).map((edge) => ({
    fromId: edge.fromId,
    fromKind: edge.fromKind,
    toId: edge.toId,
    toKind: edge.toKind,
  }));
  const result = invalidate(parsed.data.versionIds, edges);
  const estimatedUsd = estimateInvalidation(result.regenerationKeys, 1.2);
  if (!parsed.data.confirm) {
    return Response.json({ ...result, estimatedUsd, needsConfirm: true });
  }
  await markVersionsStale(result.staleIds);
  return Response.json({ ...result, estimatedUsd, needsConfirm: false });
}
