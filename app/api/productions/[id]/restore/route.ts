import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getProductionForUser } from "@/lib/production/store";

const Schema = z.object({ versionId: z.string().min(1) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await context.params;
  const production = await getProductionForUser(userId, id);
  if (!production) return Response.json({ error: "Not found." }, { status: 404 });
  const parsed = Schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a version." }, { status: 400 });
  const version = await db.entityVersion.findFirst({
    where: { id: parsed.data.versionId },
    include: { entity: true },
  });
  if (!version || version.entity.productionId !== id) {
    return Response.json({ error: "That version was not found." }, { status: 404 });
  }
  await db.productionEntity.update({
    where: { id: version.entityId },
    data: { currentVersionId: version.id, acceptedVersionId: version.id },
  });
  await db.entityVersion.update({ where: { id: version.id }, data: { status: "accepted" } });
  return Response.json({ ok: true });
}
