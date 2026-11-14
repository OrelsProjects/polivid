import { z } from "zod";
import { AUDIO_TRACKS, SPEECH_MODES } from "@/lib/production/schema/enums";
import { PRODUCTION_VIDEO_MODEL_IDS } from "@/lib/production/hints";
import { defineTool } from "@/lib/tools/define";
import { idField } from "@/lib/tools/fields";

const productionId = () => idField("Production id from list_my_productions or start_production.");

const productionModel = () =>
  z
    .enum(PRODUCTION_VIDEO_MODEL_IDS as [string, ...string[]])
    .optional()
    .describe("Footage model id. Only models list_models marks production: true can film production shots.");

/** Planning hints as a tool field. The same shape is stored on the production (lib/production/hints.ts). */
export const productionHintsField = () =>
  z
    .object({
      sceneCount: z.number().int().min(1).max(20).optional().describe("Exactly this many script scenes."),
      sceneSeconds: z
        .array(z.number().positive().max(180))
        .min(1)
        .max(20)
        .optional()
        .describe("Seconds per scene, in order. Also sets the scene count. Should add up to durationSec."),
      maxShotSec: z.number().positive().max(30).optional().describe("No shot runs longer than this."),
      music: z.boolean().optional().describe("true adds a music bed, false forbids music."),
      musicStyle: z.string().trim().max(300).optional().describe("Genre, mood, tempo, instruments for the music."),
      sfx: z.boolean().optional().describe("true adds sound effects for key actions, false forbids them."),
      ambience: z.boolean().optional().describe("true adds a background sound bed per location, false forbids it."),
      narratorVoiceId: z.string().trim().max(80).optional().describe("Speech library voice id from list_voices for narration."),
      transition: z.enum(["cut", "dissolve"]).optional().describe("How shots join in the finished film."),
      videoModel: productionModel(),
      notes: z.string().trim().max(2000).optional().describe("Any other rule the planner must follow."),
    })
    .optional()
    .describe("Hard planning constraints. Leave a field out to let the planner decide it.");

const free = { readOnly: false, spendsCredits: false, destructive: false, longRunning: false } as const;

const planTool = (definition: { name: string; title: string; summary: string; whenToUse: string[]; avoidWhen?: string[]; inputSchema: z.ZodType }) =>
  defineTool({ ...definition, category: "plan", effects: free, approval: "none", runsOn: "server", surfaces: ["coach", "mcp"] });

const locked = "Only before approval. Once filming starts, use production_refilm_shot or the edit_* tools on the finished cut.";

export const productionTools = [
  defineTool({
    name: "production_replan",
    title: "Re-plan a production",
    category: "plan",
    summary: "Set planning hints (scene count, scene lengths, music, sfx, ambience, narrator, transitions, model) and plan the production again. No credits.",
    whenToUse: [
      "They want a different number of scenes, other scene lengths, no music, more sound effects, or a different model, before filming.",
      "The plan came back wrong and a few hard rules will fix it.",
    ],
    avoidWhen: [`Changing one shot or one sound. Use production_update_shot or production_update_audio. ${locked}`],
    inputSchema: z.object({
      productionId: productionId(),
      hints: productionHintsField().unwrap().describe("Hard planning rules. Fields you leave out keep their earlier value."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: true },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  planTool({
    name: "production_update_shot",
    title: "Change a shot",
    summary: `Rewrite one planned shot: action, framing, camera move, length, speech mode, or model. Free. ${locked}`,
    whenToUse: ["They want a specific shot different: longer, a close-up, a slow push-in, another model."],
    inputSchema: z.object({
      productionId: productionId(),
      shotId: idField("Shot id from get_production."),
      action: z.string().trim().max(2000).optional().describe("What happens in the shot."),
      purpose: z.string().trim().max(500).optional().describe("Why the shot is there."),
      framing: z.string().trim().max(300).optional().describe("e.g. wide, medium, close-up, over the shoulder."),
      cameraMotion: z.string().trim().max(300).optional().describe("e.g. static, slow push-in, handheld, orbit."),
      emotionalArc: z.string().trim().max(300).optional().describe("How the feeling changes across the shot."),
      intendedBeginning: z.string().trim().max(500).optional().describe("The first frame."),
      intendedEnding: z.string().trim().max(500).optional().describe("The last frame."),
      seconds: z.number().positive().max(30).optional().describe("Length on screen."),
      speechMode: z.enum(SPEECH_MODES).optional().describe("offscreen, native (the model voices it), or lipsync."),
      model: z
        .union([z.enum(PRODUCTION_VIDEO_MODEL_IDS as [string, ...string[]]), z.literal("")])
        .optional()
        .describe("Model for this shot, or empty to use the production's."),
    }),
  }),
  planTool({
    name: "production_remove_shot",
    title: "Remove a shot",
    summary: `Drop a planned shot, and any sound that only played under it. Free. ${locked}`,
    whenToUse: ["A shot isn't needed, or the film should be shorter."],
    inputSchema: z.object({ productionId: productionId(), shotId: idField("Shot id from get_production.") }),
  }),
  planTool({
    name: "production_update_audio",
    title: "Change a sound",
    summary: `Change a planned line, narration, music, ambience, or sound effect: words, voice, prompt, timing, fades, or which shots it plays under. Free. ${locked}`,
    whenToUse: ["They want a line reworded, a different voice, calmer music, or an effect moved."],
    inputSchema: z.object({
      productionId: productionId(),
      audioId: idField("Audio segment id from get_production."),
      text: z.string().trim().max(5000).nullable().optional().describe("Words, for dialogue and narration."),
      prompt: z.string().trim().max(1000).nullable().optional().describe("Sound description, for music, ambience, and sfx."),
      voiceId: z.string().trim().max(80).nullable().optional().describe("Speech library voice id from list_voices."),
      seconds: z.number().positive().max(180).optional().describe("How long it plays."),
      startOffsetSec: z.number().min(0).max(180).optional().describe("Start, from the beginning of its first shot."),
      fadeInSec: z.number().min(0).max(10).optional().describe("Fade in, in seconds."),
      fadeOutSec: z.number().min(0).max(10).optional().describe("Fade out, in seconds."),
      shotIds: z.array(z.string().trim().min(1)).min(1).max(40).optional().describe("Shots it plays under."),
    }),
  }),
  planTool({
    name: "production_add_audio",
    title: "Add a sound",
    summary: `Add a line, narration, music bed, ambience, or sound effect under chosen shots. Free. ${locked}`,
    whenToUse: ["They want music added, a whoosh on a cut, rain ambience, or an extra narrated line."],
    inputSchema: z.object({
      productionId: productionId(),
      track: z.enum(AUDIO_TRACKS).describe("dialogue, narration, music, ambience, or sfx."),
      shotIds: z.array(z.string().trim().min(1)).min(1).max(40).describe("Shots it plays under, from get_production."),
      seconds: z.number().positive().max(180).describe("How long it plays."),
      text: z.string().trim().max(5000).optional().describe("Words, required for dialogue and narration."),
      prompt: z.string().trim().max(1000).optional().describe("Sound description, required for music, ambience, and sfx."),
      voiceId: z.string().trim().max(80).optional().describe("Speech library voice id, for dialogue and narration."),
      startOffsetSec: z.number().min(0).max(180).optional().describe("Start, from the beginning of its first shot. Defaults to 0."),
      fadeInSec: z.number().min(0).max(10).optional().describe("Fade in, in seconds. Music defaults to 0.5."),
      fadeOutSec: z.number().min(0).max(10).optional().describe("Fade out, in seconds. Music defaults to 1."),
    }),
  }),
  planTool({
    name: "production_remove_audio",
    title: "Remove a sound",
    summary: `Drop a planned line, music bed, ambience, or sound effect. Free. ${locked}`,
    whenToUse: ["They want no music, or one effect or line gone."],
    inputSchema: z.object({ productionId: productionId(), audioId: idField("Audio segment id from get_production.") }),
  }),
  defineTool({
    name: "production_refilm_shot",
    title: "Refilm a shot",
    category: "jobs",
    summary: "Film one shot of a production again, optionally with another model, then rebuild the film. Spends credits for that shot only.",
    whenToUse: [
      "Filming started or finished and one shot came out wrong.",
      "They want a single shot redone with a better model.",
    ],
    avoidWhen: [
      "Nothing is filmed yet. Change the plan with production_update_shot instead.",
      "They want the whole film again. Use regenerate_production.",
    ],
    inputSchema: z.object({
      productionId: productionId(),
      shotId: idField("Shot id from get_production."),
      model: productionModel(),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    approvalCredits: 1,
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: (input) => `shot ${String(input.shotId ?? "")}${input.model ? ` · ${String(input.model)}` : ""}`,
  }),
];
