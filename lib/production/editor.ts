import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { createProjectFromTimelineForUser, getProjectForUser } from "@/lib/editor/projects";
import { VIDEO_FORMATS, type VideoFormat } from "@/lib/video/schema";
import { db } from "@/lib/db";
import type { ProductionTimeline } from "./schema";
import { currentEntityData, listAssets } from "./store";
import { compileToEditorTimeline } from "./timeline";

const EDITOR_ASSET_KINDS = ["video", "audio", "image"] as const;
type EditorAssetKind = (typeof EDITOR_ASSET_KINDS)[number];

const isVideoFormat = (value: string): value is VideoFormat =>
  (VIDEO_FORMATS as readonly string[]).includes(value);

const isEditorAssetKind = (kind: string): kind is EditorAssetKind =>
  EDITOR_ASSET_KINDS.includes(kind as EditorAssetKind);

const nameForAsset = (asset: { id: string; kind: string }, clips: ProductionTimeline["clips"]) => {
  const clip = clips.find((entry) => entry.assetId === asset.id);
  if (!clip) return asset.kind;
  return clip.id.replace(/^clip_/, "").replaceAll("_", " ");
};

export const openEditorProjectForProduction = async (userId: string, productionId: string) => {
  const production = await db.production.findFirst({ where: { id: productionId, userId } });
  if (!production) return null;

  const timeline = await currentEntityData<ProductionTimeline>(productionId, "timeline", "timeline");
  if (!timeline) return null;
  const assets = (await listAssets(productionId)).filter((asset) => asset.status === "accepted");
  const format = isVideoFormat(production.format) ? production.format : "9:16";
  const editorTimeline = compileToEditorTimeline(
    timeline,
    format,
    assets.filter((asset) => isEditorAssetKind(asset.kind)).map((asset) => ({
      id: asset.id,
      kind: asset.kind as EditorAssetKind,
      name: nameForAsset(asset, timeline.clips),
    })),
  );

  if (production.editProjectId) {
    const existing = await getProjectForUser(userId, production.editProjectId);
    if (existing) {
      await db.editProject.update({
        where: { id: existing.id },
        data: {
          title: production.title,
          format,
          timeline: editorTimeline as unknown as Prisma.InputJsonValue,
          version: existing.version + 1,
        },
      });
      return getProjectForUser(userId, existing.id);
    }
  }

  const project = await createProjectFromTimelineForUser(userId, {
    title: production.title,
    format,
    timeline: editorTimeline,
  });
  const linked = await db.production.updateMany({
    where: { id: productionId, userId, editProjectId: null },
    data: { editProjectId: project.id },
  });
  if (linked.count === 0) {
    await db.editProject.deleteMany({ where: { id: project.id, userId } });
    const fresh = await db.production.findFirst({ where: { id: productionId, userId } });
    if (fresh?.editProjectId) return getProjectForUser(userId, fresh.editProjectId);
  }
  return project;
};
