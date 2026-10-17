import "server-only";
import { exportProjectFromInput } from "@/lib/editor/export";
import { createBlankProjectForUser, openProjectForVideoForUser } from "@/lib/editor/projects";
import { openEditorProjectForProduction } from "@/lib/production/editor";
import type { ToolHandler } from "@/lib/tools/types";
import { asRecord, formatOf, text } from "./support";

const projectResult = (project: { id: string } | null, missing: string) => {
  if (!project) return { error: missing };
  return { projectId: project.id, href: `/editor/${project.id}` };
};

export const openInEditorHandler: ToolHandler = async (input, ctx) => {
  const row = asRecord(input);
  const videoId = text(row.videoId);
  const productionId = text(row.productionId);
  if (videoId && productionId) return { error: "Pass a video or a production, not both." };
  if (videoId) {
    return projectResult(await openProjectForVideoForUser(ctx.userId, videoId), "That video is not ready to edit.");
  }
  if (productionId) {
    return projectResult(
      await openEditorProjectForProduction(ctx.userId, productionId),
      "That production has no timeline to edit yet.",
    );
  }
  const format = formatOf(row.format, "9:16");
  const project = await createBlankProjectForUser(ctx.userId, format);
  return { projectId: project.id, href: `/editor/${project.id}` };
};

export const exportEditHandler: ToolHandler = async (input, ctx) => {
  const result = await exportProjectFromInput(ctx.userId, text(asRecord(input).projectId));
  if ("error" in result) return result;
  return { jobId: result.jobId };
};
