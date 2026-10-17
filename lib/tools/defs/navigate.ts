import { z } from "zod";
import { defineTool } from "@/lib/tools/define";
import {
  characterField,
  formatField,
  idField,
  lengthField,
  mediaKeyField,
  presetField,
  referenceKeysField,
  tierField,
  visualDirectionField,
} from "@/lib/tools/fields";
import { VIDEO_MODE_IDS } from "@/lib/video/modes";

export const navigateTools = [
  defineTool({
    name: "app_open_create",
    title: "Open Create",
    category: "navigate",
    summary: "Open the Create form with these settings filled in. Does not spend credits.",
    whenToUse: [
      "They want to tweak the form themselves instead of generating now.",
      "Pass mode so the right Create page opens: prompt, voiceover, motion-graphics, music, avatar, image, av-to-video, lyrics, or captions.",
      "Pass referenceKeys so attached pictures are waiting. Pass mediaKey so an attached song or clip is waiting.",
    ],
    avoidWhen: ["They already approved a brief. Call the matching make tool instead."],
    inputSchema: z.object({
      prompt: z.string().describe("Text to put in the prompt box. May be empty when the mode allows it."),
      mode: z.enum(VIDEO_MODE_IDS).optional().describe("Create mode page to open. Defaults to the prompt page."),
      format: formatField().optional(),
      length: lengthField().optional(),
      tier: tierField(),
      presetId: presetField(),
      visualDirection: visualDirectionField(),
      characterId: characterField(),
      referenceKeys: referenceKeysField(),
      mediaKey: mediaKeyField("Upload key for a song, photo, or source clip that the mode requires."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "client",
    surfaces: ["coach"],
    examples: [
      {
        request: "Put this on the form, I'll press generate.",
        input: { prompt: "A cat on a roof at dusk", mode: "prompt", format: "9:16", length: 15 },
      },
    ],
  }),
  defineTool({
    name: "app_open_video",
    title: "Open a video",
    category: "navigate",
    summary: "Open one of the person's videos.",
    whenToUse: ["They want to watch a video you just queued or one they already have."],
    inputSchema: z.object({
      videoId: idField("Video id from list_my_videos or from a make tool result."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "client",
    surfaces: ["coach"],
  }),
  defineTool({
    name: "app_open_production",
    title: "Open a production",
    category: "navigate",
    summary: "Open one of the person's productions.",
    whenToUse: ["They should review a staged production, answer its questions, or watch its progress."],
    inputSchema: z.object({
      productionId: idField("Production id from list_my_productions or start_production."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "client",
    surfaces: ["coach"],
  }),
  defineTool({
    name: "app_open_editor",
    title: "Open the editor",
    category: "navigate",
    summary: "Open an editor project.",
    whenToUse: ["open_in_editor just returned a projectId and they should land on the timeline."],
    avoidWhen: ["You have not created the project yet. Call open_in_editor first."],
    inputSchema: z.object({
      projectId: idField("Editor project id from open_in_editor."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "client",
    surfaces: ["coach"],
  }),
];
