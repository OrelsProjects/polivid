import { z } from "zod";
import { defineModeTool, defineTool } from "@/lib/tools/define";
import {
  characterField,
  formatField,
  lengthField,
  mediaKeyField,
  optionalPromptField,
  presetField,
  promptField,
  referenceKeysField,
  tierField,
  videoApprovalDetail,
  visualDirectionField,
} from "@/lib/tools/fields";
import { VIDEO_MODE_IDS, VIDEO_TIERS } from "@/lib/video/modes";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";
import { MAX_LYRICS_NOTE, MAX_PROMPT_LENGTH, MAX_REFERENCE_IMAGES, VIDEO_FORMATS } from "@/lib/video/schema";

const filmed = () => ({
  format: formatField(),
  length: lengthField(),
  tier: tierField(),
  presetId: presetField(),
  visualDirection: visualDirectionField(),
});

const note = (description: string) =>
  z.string().trim().max(MAX_LYRICS_NOTE).optional().describe(description);

export const makeTools = [
  defineModeTool({
    modeId: "prompt",
    name: "make_prompt_video",
    whenToUse: [
      "They want a filmed clip from a description, with no upload required.",
      "Optional reference pictures can lock a person or a look. Copy attached picture keys into referenceKeys.",
      "A character narrates when the mode is prompt and the character has a voice. Pass characterId.",
      "Write one action per beat. Create films this as 5–7 second clips that continue from the previous last frame.",
    ],
    avoidWhen: [
      "They pasted a script to be spoken. Use make_voiceover_video.",
      "They pasted lyrics. Use make_lyrics_video.",
      "They want a multi-scene film with dialogue control. Use start_production.",
    ],
    inputSchema: z.object({
      prompt: promptField("What to film. Subject, one action, setting, camera, light, and mood."),
      ...filmed(),
      showText: z.boolean().optional().describe("Whether on-screen text is allowed. Defaults to yes."),
      characterId: characterField(),
      referenceKeys: referenceKeysField(),
    }),
    approvalDetail: videoApprovalDetail("prompt"),
    examples: [
      {
        request: "A 15 second vertical clip of a cat on a roof at dusk.",
        input: { prompt: "A cat steps onto a tiled roof at dusk", format: "9:16", length: 15, tier: "pro" },
      },
    ],
  }),
  defineModeTool({
    modeId: "voiceover",
    name: "make_voiceover_video",
    whenToUse: [
      "They have a script, or a link's worth of words, that should be spoken over footage.",
      "Aim for 150–170 spoken words per minute. Pass characterId when a saved character or the studio narrator should speak.",
    ],
    avoidWhen: [
      "The words are lyrics for a music video. Use make_lyrics_video.",
      "A photo of a person should say the lines to camera. Use make_avatar_video.",
    ],
    inputSchema: z.object({
      prompt: promptField("The script to speak, or the article text to turn into narration."),
      ...filmed(),
      characterId: characterField(),
    }),
    approvalDetail: videoApprovalDetail("voiceover"),
  }),
  defineModeTool({
    modeId: "motion-graphics",
    name: "make_motion_graphics",
    whenToUse: [
      "They want charts, titles, or a designed motion-graphics piece rather than filmed footage.",
      "On the ultra tier, every number must come from a source they gave you. Do not invent figures.",
    ],
    avoidWhen: [
      "They want a filmed scene. Use make_prompt_video.",
      "They want a character to narrate. This mode keeps its own audio. Leave the character off.",
    ],
    inputSchema: z.object({
      prompt: promptField("The idea. Name any figures that should appear. On ultra, include where each number came from."),
      ...filmed(),
    }),
    approvalDetail: videoApprovalDetail("motion-graphics"),
  }),
  defineModeTool({
    modeId: "music",
    name: "make_music_video",
    whenToUse: [
      "They uploaded a song, or attached one in chat, and want visuals that follow the track.",
      "mediaKey is the audio upload. If you omit it, the attached audio file is used.",
    ],
    avoidWhen: [
      "They only pasted lyrics and need a new song. Use compose_song, then make_lyrics_video.",
      "They want captions on a clip. Use add_captions.",
    ],
    inputSchema: z.object({
      prompt: optionalPromptField("How the visuals should feel. Optional. The track drives the motion."),
      mediaKey: mediaKeyField("Audio upload key. Omit to use the attached audio file."),
      ...filmed(),
    }),
    approvalDetail: videoApprovalDetail("music"),
  }),
  defineModeTool({
    modeId: "avatar",
    name: "make_avatar_video",
    whenToUse: [
      "A photo of a person should say a script to camera.",
      "mediaKey is that photo. If you omit it, the attached picture is used.",
    ],
    avoidWhen: [
      "Nobody is on camera. Use make_voiceover_video.",
      "The photo should only guide a filmed scene. Use make_prompt_video with referenceKeys.",
    ],
    inputSchema: z.object({
      prompt: promptField("The words this person should say, looking at the camera."),
      mediaKey: mediaKeyField("Photo upload key. Omit to use the attached picture."),
      format: formatField(),
      length: lengthField(),
      tier: tierField(),
    }),
    approvalDetail: videoApprovalDetail("avatar"),
  }),
  defineModeTool({
    modeId: "image",
    name: "make_image_video",
    whenToUse: [
      "They want a still animated into a short clip. The picture becomes the first frame.",
      "mediaKey is that still. A character can narrate. Pass characterId when they attached one.",
    ],
    avoidWhen: ["They want a new picture first. Use generate_image, then pass its key here."],
    inputSchema: z.object({
      prompt: promptField("The motion. What moves, and how."),
      mediaKey: mediaKeyField("Still-image upload key. Omit to use the attached picture."),
      ...filmed(),
      characterId: characterField(),
    }),
    approvalDetail: videoApprovalDetail("image"),
  }),
  defineModeTool({
    modeId: "av-to-video",
    name: "make_av_cut",
    whenToUse: [
      "They uploaded audio or video and want the useful parts cut into a short clip.",
      "mediaKey is that file. If you omit it, the attached audio or video is used.",
    ],
    avoidWhen: [
      "They want captions burned onto the whole video. Use add_captions.",
      "They want new footage. Use make_prompt_video.",
    ],
    inputSchema: z.object({
      prompt: optionalPromptField("What the cut should keep. Optional."),
      mediaKey: mediaKeyField("Source audio or video upload key. Omit to use the attached file."),
      ...filmed(),
    }),
    approvalDetail: videoApprovalDetail("av-to-video"),
  }),
  defineModeTool({
    modeId: "lyrics",
    name: "make_lyrics_video",
    whenToUse: [
      "They pasted lyrics, or a song take already exists.",
      "The prompt is the lyric lines. Optional pictures lock a singer or a look. Copy attached picture keys into referenceKeys.",
      "On this mode the character voice performs the lyric lines. Pass characterId, and pass songId when compose_song or list_songs already made the take.",
      "Lyrics stay on screen. Do not turn this into a silent clip.",
    ],
    avoidWhen: [
      "They uploaded a finished song file. Use make_music_video.",
      "There is no song yet and they want one generated. Call compose_song first, then pass songId here.",
    ],
    inputSchema: z.object({
      prompt: promptField("The lyric lines this video performs."),
      ...filmed(),
      characterId: characterField(),
      referenceKeys: referenceKeysField(),
      songId: z.string().uuid().optional().describe("Song take id from compose_song or list_songs. Omit to compose during the video."),
      direction: note("Camera, pacing, and performance notes."),
      scene: note("Location, set, and wardrobe."),
    }),
    approvalDetail: videoApprovalDetail("lyrics"),
  }),
  defineModeTool({
    modeId: "captions",
    name: "add_captions",
    whenToUse: [
      "They want captions on a video they uploaded.",
      "mediaKey is that video. If you omit it, the attached video is used.",
      "Keep captions to three to five words per line, in the middle third, high contrast.",
    ],
    avoidWhen: [
      "There is no video file. Do not invent one.",
      "They want a new visual style. Captions do not take a visual preset.",
    ],
    inputSchema: z.object({
      prompt: optionalPromptField("Optional notes. Leave empty to caption the upload as-is."),
      mediaKey: mediaKeyField("Video upload key. Omit to use the attached video."),
      format: formatField(),
      length: lengthField(),
      tier: tierField(),
    }),
    approvalDetail: videoApprovalDetail("captions"),
  }),
  defineTool({
    name: "create_video",
    title: "Generate this video",
    category: "make",
    summary: "Queue a Create video in any mode. Prefer the make_* tool for that mode.",
    whenToUse: ["Only when an older chat already started this tool. New requests use the mode tools."],
    inputSchema: z.object({
      prompt: z.string().trim().min(3).max(MAX_PROMPT_LENGTH).describe("What to generate."),
      format: z.enum(VIDEO_FORMATS).describe("Frame. 9:16, 1:1, or 16:9."),
      length: z.number().int().min(2).max(90).describe("Length in seconds, from 2 to 90."),
      mode: z.enum(VIDEO_MODE_IDS).optional().describe("Create mode. Defaults to prompt."),
      tier: z.enum(VIDEO_TIERS).optional().describe("Quality: low, pro, or ultra. Defaults to pro."),
      showText: z.boolean().optional().describe("Whether on-screen text is allowed."),
      presetId: z.string().max(80).optional().describe("Visual preset id."),
      visualDirection: z
        .string()
        .max(MAX_VISUAL_DIRECTION)
        .optional()
        .describe(`Look and shot notes, at most ${MAX_VISUAL_DIRECTION} characters.`),
      characterId: z.string().optional().describe("Character id: off, studio, or a saved character."),
      mediaKey: z.string().optional().describe("Upload key when the mode needs a file."),
      referenceKeys: z
        .array(z.string().trim().min(1).max(200))
        .max(MAX_REFERENCE_IMAGES)
        .optional()
        .describe("Reference picture keys for prompt and lyrics."),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach"],
    status: "legacy",
    approvalDetail: (input) => videoApprovalDetail(String(input.mode ?? "prompt"))(input),
  }),
  defineTool({
    name: "start_production",
    title: "Start this production",
    category: "make",
    summary: "Start a staged production for a multi-scene film. Starting the plan costs 1 credit. Filming spends credits when the preview is approved.",
    whenToUse: [
      "They asked for a multi-scene film, dialogue, or tighter control than a single Create video.",
      "Pass characterId when an attached character should speak every line and add its picture as a reference.",
    ],
    avoidWhen: [
      "A short first cut is enough. Use the matching make_* tool.",
      "They only want the Create form filled in. Use app_open_create.",
    ],
    inputSchema: z.object({
      text: z.string().trim().min(3).max(20_000).describe("The idea, outline, or script to produce."),
      format: z.enum(VIDEO_FORMATS).optional().describe("Frame. Defaults to 9:16."),
      durationSec: z.number().int().min(5).max(180).optional().describe("Target length in seconds, from 5 to 180. Defaults to 30."),
      mode: z.enum(["review", "auto"]).optional().describe("review stops for the person. auto continues. Defaults to review."),
      presetId: presetField(),
      visualDirection: visualDirectionField(),
      characterId: characterField(),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: (input) => {
      const parts = [String(input.format ?? "9:16"), `${String(input.durationSec ?? 30)}s`];
      if (typeof input.characterId === "string" && input.characterId && input.characterId !== "off") parts.push("character");
      return parts.join(" · ");
    },
    examples: [
      {
        request: "A three-scene story about a night bus.",
        input: { text: "Three scenes on a night bus, two people, one decision.", format: "9:16", durationSec: 45, mode: "review" },
      },
    ],
  }),
];
