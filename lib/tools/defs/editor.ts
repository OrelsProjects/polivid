import { z } from "zod";
import { defineTool } from "@/lib/tools/define";
import { formatField, idField } from "@/lib/tools/fields";

export const editorTools = [
  defineTool({
    name: "open_in_editor",
    title: "Open in the editor",
    category: "editor",
    summary: "Open a ready video or a finished production as an editor project. Does not spend credits.",
    whenToUse: [
      "They want to trim, rearrange, or title a video that is already ready.",
      "Pass videoId or productionId, not both. Then call app_open_editor with the returned projectId.",
    ],
    avoidWhen: ["The video is still filming. Wait, or use pause_video."],
    inputSchema: z.object({
      videoId: idField("Ready video to open.").optional(),
      productionId: idField("Production whose timeline should open.").optional(),
      format: formatField().optional().describe("Frame for a blank project. Ignored when a video or production is set."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "export_edit",
    title: "Export an edit",
    category: "editor",
    summary: "Render an editor project to a video. Spends credits.",
    whenToUse: ["They finished an edit and want the video file."],
    avoidWhen: ["There is no editor project yet. Call open_in_editor first."],
    inputSchema: z.object({
      projectId: idField("Editor project id from open_in_editor."),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: (input) => `export ${String(input.projectId ?? "")}`,
  }),
];
