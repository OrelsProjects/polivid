import "server-only";
import { db } from "@/lib/db";
import { getProductionForUser } from "./store";

/** Points one entity back at an earlier version. The production must belong to the user. */
export const restoreProductionVersion = async (userId: string, productionId: string, versionId: string) => {
  const production = await getProductionForUser(userId, productionId);
  if (!production) return { error: "Production not found." };
  const version = await db.entityVersion.findFirst({
    where: { id: versionId },
    include: { entity: true },
  });
  if (!version || version.entity.productionId !== productionId) {
    return { error: "That version was not found." };
  }
  await db.productionEntity.update({
    where: { id: version.entityId },
    data: { currentVersionId: version.id, acceptedVersionId: version.id },
  });
  await db.entityVersion.update({ where: { id: version.id }, data: { status: "accepted" } });
  return { ok: true as const };
};
