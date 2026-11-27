import { describeEdit, EDIT_CREDITS, EDIT_OPS, editValueFor, isEditOp } from "@/lib/video/edit-ops";
import { BACKGROUND_IDS } from "@/lib/video/backgrounds";
import { VISUAL_MEDIA } from "@/lib/video/stills";
import { z } from "zod";
import { SKIT_LOOK_CHOICES } from "@/lib/video/skit";
import { defineModeTool, defineTool } from "@/lib/tools/define";
import { productionHintsField } from "@/lib/tools/defs/production";
import {
  attachmentRolesField,
  briefField,
  characterClipField,
  characterField,
  characterLookField,
  clipsField,
  cutsField,
  formatField,
  modelField,
  pictureKeysField,
  showTextField,
  sourceUrlField,
  templateField,
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
import { LAYOUT_MEDIA_ROLES, LAYOUT_STYLE_IDS } from "@/lib/video/layout/styles";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";
import { MAX_LYRICS_NOTE, MAX_PROMPT_LENGTH, MAX_REFERENCE_IMAGES, VIDEO_FORMATS } from "@/lib/video/schema";
import {
  MAX_SWAP_CHARACTERS,
  MAX_SWAP_EDIT_SECONDS,
  MAX_SWAP_TOTAL_SECONDS,
  MAX_SWAP_SECONDS,
  MIN_SWAP_SECONDS,
  SWAP_METHODS,
  SWAP_ORIENTATIONS,
  SWAP_PROMPT_LIMIT,
  swapResolutionFor,
} from "@/lib/video/swap";

const filmed = () => ({
  format: formatField(),
  length: lengthField(),
  tier: tierField(),
  model: modelField(),
  presetId: presetField(),
  visualDirection: visualDirectionField(),
  showText: showTextField(),
  template: templateField(),
});

/** Motion graphics are drawn in code, not filmed, so there is no footage model to pick. */
const drawn = () => ({
  format: formatField(),
  length: lengthField(),
  tier: tierField(),
  presetId: presetField(),
  visualDirection: visualDirectionField(),
  showText: showTextField(),
  template: templateField(),
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
      "A character with a voice is added after filming as its own Voiceover clip. The footage itself has no voiceover. Pass characterId.",
      "Write the video prompt as numbered beats, one action each, in order. Do not describe later beats inside an earlier one.",
      "Pass vo as the brief's spoken lines, one beat per line. Pass none when the brief has no voiceover.",
      "When a brief lists frames:, pass those keys as referenceKeys in the same order.",
      "To control the shots yourself, pass cuts (seconds and camera per shot, from make_storyboard scenes). Otherwise clips sets only the shot count.",
    ],
    avoidWhen: [
      "They pasted a script to be spoken. Use make_voiceover_video.",
      "They pasted lyrics. Use make_lyrics_video.",
      "They want a multi-scene film with dialogue control. Use start_production.",
    ],
    inputSchema: z.object({
      prompt: promptField("What to film. Numbered beats, one action each, in order."),
      ...filmed(),
      clips: clipsField(),
      cuts: cutsField(),
      brief: briefField(),
      attachmentRoles: attachmentRolesField(),
      characterId: characterField(),
      characterLookId: characterLookField(),
      useCharacterClip: characterClipField(),
      referenceKeys: referenceKeysField(),
      vo: z
        .string()
        .trim()
        .max(2000)
        .optional()
        .describe("Spoken lines, one beat per line. Pass none when the brief has no voiceover."),
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
      "Pass media stills for drawn, slowly moving pictures at a fraction of the cost of filming. Pass media loop to read the words over a looping background, the cheapest option. Both need a voice.",
      "Pass verbatim true when they want their words read exactly as written. The length then follows the script.",
      "In a verbatim script, text in [brackets] is never read. With media stills, each line is one picture and a bracket note says what it shows. [pause 1s] holds a silence with stills and loop.",
      "A prompt that is only a link is read and turned into the script.",
    ],
    avoidWhen: [
      "The words are lyrics for a music video. Use make_lyrics_video.",
      "A photo of a person should say the lines to camera. Use make_avatar_video.",
    ],
    inputSchema: z.object({
      prompt: promptField("The script to speak, or the article text to turn into narration."),
      ...filmed(),
      characterId: characterField(),
      characterLookId: characterLookField(),
      useCharacterClip: characterClipField(),
      media: z
        .enum(VISUAL_MEDIA)
        .optional()
        .describe("What illustrates it: video films every scene, stills draws and animates pictures, loop plays a background clip. Defaults to video."),
      verbatim: z
        .boolean()
        .optional()
        .describe("Read the prompt word for word instead of rewriting it to fit the length."),
      backgroundId: z
        .enum(BACKGROUND_IDS)
        .optional()
        .describe("Built-in background for media loop (list_backgrounds). Defaults to aurora."),
      backgroundKey: mediaKeyField("Their own uploaded video to loop behind the words, instead of backgroundId. Media loop only."),
      sourceUrl: sourceUrlField(),
    }),
    approvalDetail: videoApprovalDetail("voiceover"),
  }),
  defineModeTool({
    modeId: "shorts",
    name: "make_shorts_video",
    whenToUse: [
      "They want a Short, TikTok, or Reel where their character says a script to camera.",
      "Pass the script word for word as prompt. The character's voice speaks it as written.",
      "Pass characterId. It must be a saved character with a picture, not off or the studio narrator.",
      "Pass presetId for the look. Pass one picture key in referenceKeys only when they gave a background picture.",
    ],
    avoidWhen: [
      "No character should appear on screen. Use make_voiceover_video.",
      "They gave a photo of someone who is not a saved character. Use make_avatar_video.",
      "They want several scenes or dialogue. Use start_production.",
    ],
    inputSchema: z.object({
      prompt: promptField("The script, word for word. The character says exactly this."),
      ...filmed(),
      characterId: characterField(),
      characterLookId: characterLookField(),
      useCharacterClip: characterClipField(),
      referenceKeys: z
        .array(z.string().trim().min(1))
        .max(1)
        .optional()
        .describe("Optional. One picture key for the background. Leave it out to let the look decide the setting."),
    }),
    approvalDetail: videoApprovalDetail("shorts"),
    examples: [
      {
        request: "Make a 20 second TikTok where Orel reads this script in a bright office.",
        input: { prompt: "Writing your Notes around you is costing you subscribers.", format: "9:16", length: 20, tier: "pro" },
      },
    ],
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
      ...drawn(),
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
      "A photo of a person, or a saved character, should say a script to camera with real lip sync.",
      "HeyGen Avatar 6 animates one picture to the voice track. The script is spoken word for word and sets the length.",
      "Pass characterId to use that character's picture and voice. Pass characterLookId for one of its looks.",
      "mediaKey is a photo to use instead of the character's picture. With a character, the photo speaks in the character's voice. With no character, the studio voice reads it.",
    ],
    avoidWhen: [
      "Nobody is on camera. Use make_voiceover_video.",
      "The character should hold a product, like a creator's ad. Use make_ugc_video.",
      "The photo should only guide a filmed scene. Use make_prompt_video with referenceKeys.",
    ],
    inputSchema: z.object({
      prompt: promptField("The words to say to camera, word for word."),
      mediaKey: mediaKeyField("Optional photo upload key. Omit to use the character's picture, or the attached picture."),
      characterId: characterField(),
      characterLookId: characterLookField(),
      format: formatField(),
      tier: tierField(),
      model: modelField(),
      visualDirection: visualDirectionField(),
    }),
    approvalDetail: videoApprovalDetail("avatar"),
    examples: [
      {
        request: "Have Orel say this to camera as a vertical video.",
        input: { prompt: "Three things I learned shipping every week for a year.", format: "9:16", tier: "pro" },
      },
    ],
  }),
  defineModeTool({
    modeId: "ugc",
    name: "make_ugc_video",
    whenToUse: [
      "They want a UGC ad, testimonial, or product review where their character talks about a product to camera, like a creator's selfie video.",
      "First a still is made of the character, with the product photo when there is one, then HeyGen Avatar 6 lip-syncs it to the character's voice. The script is spoken word for word and sets the length.",
      "Pass characterId. It must be a saved character with a picture. Pass characterLookId for one of its looks.",
      "mediaKey is the product photo. It is optional. If you omit it, the attached picture is used when there is one.",
      "Pass the script as they wrote it. Nothing is added to the picture or the motion beyond what they ask for.",
      "visualDirection is how the picture and the motion should look: the place, what they hold, how they move. Pass only what they asked for.",
    ],
    avoidWhen: [
      "There is no character, only a product. Use make_image_video for a product clip.",
      "They want a filmed ad with several scenes. Use start_production.",
    ],
    inputSchema: z.object({
      prompt: promptField("What the character says about the product, word for word."),
      mediaKey: mediaKeyField("Optional product photo upload key. Omit to use the attached picture."),
      characterId: characterField(),
      characterLookId: characterLookField(),
      format: formatField(),
      tier: tierField(),
      model: modelField(),
      visualDirection: visualDirectionField(),
    }),
    approvalDetail: videoApprovalDetail("ugc"),
    examples: [
      {
        request: "Make a UGC ad of Dana holding this serum, in her bathroom.",
        input: {
          prompt: "My skin was so dry every winter. Then I tried this serum. Two weeks in, it's honestly glowing. Link's below.",
          format: "9:16",
          tier: "pro",
          visualDirection: "A bright bathroom, morning light.",
        },
      },
    ],
  }),
  defineModeTool({
    modeId: "skit",
    name: "make_skit_video",
    whenToUse: [
      "Their character should act a script out, full body: props, places, pratfalls, a funny or cartoon skit, not a talking head.",
      "Each [note in brackets] says what the character does, and steers every sentence up to the next note. Notes are never read. Write one note per beat, then the line spoken over it.",
      "Every beat is filmed on Kling from the character's pictures, keeping their own look and art style, and the character's voice reads the script word for word over the shots.",
      "Pass characterId. It must be a saved character with a picture and a voice.",
      "Skits are drawn by default: a photo character is drawn as a retro cartoon, and a character that's already drawn keeps its look. presetId picks another look, or own for the pictures as they are.",
      "4 to 8 beats is a good skit. Every beat is filmed, so beats are the cost.",
    ],
    avoidWhen: [
      "The character should talk to camera. Use make_avatar_video.",
      "The character should talk about a product, like a creator's ad. Use make_ugc_video.",
      "There is no saved character. Create one first.",
    ],
    inputSchema: z.object({
      prompt: promptField("The script: a [note] for what the character does, then the words spoken over it."),
      characterId: characterField(),
      presetId: z
        .enum(SKIT_LOOK_CHOICES)
        .optional()
        .describe(
          "The look. auto (default): a photo character is drawn in retro-cartoon, a drawn one stays as it is. own: film the character's pictures as they are. retro-cartoon, pixar (rounded 3D), claymation, pixel-art: draw the character in that look first.",
        ),
      format: formatField(),
      tier: tierField(),
      visualDirection: visualDirectionField(),
    }),
    approvalDetail: videoApprovalDetail("skit"),
    examples: [
      {
        request: "Make a funny skit of Quill losing a draft.",
        input: {
          prompt: "[Quill types fast, a coffee cup wobbles] Day one of my big essay.\n[The coffee spills on the keyboard, the screen goes black] Three hours of work. Gone.\n[Quill opens a backup and does a tiny victory dance] Back up your drafts.",
          format: "9:16",
          tier: "pro",
        },
      },
    ],
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
      characterLookId: characterLookField(),
      useCharacterClip: characterClipField(),
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
      "When a brief lists frames:, pass those keys as referenceKeys in the same order.",
    ],
    avoidWhen: [
      "They uploaded a finished song file. Use make_music_video.",
      "There is no song yet and they want one generated. Call compose_song first, then pass songId here.",
    ],
    inputSchema: z.object({
      prompt: promptField("The lyric lines this video performs."),
      ...filmed(),
      characterId: characterField(),
      characterLookId: characterLookField(),
      useCharacterClip: characterClipField(),
      referenceKeys: referenceKeysField(),
      songId: z.string().uuid().optional().describe("Song take id from compose_song or list_songs. Omit to compose during the video."),
      direction: note("Camera, pacing, and performance notes."),
      scene: note("Location, set, and wardrobe."),
      directionKeys: pictureKeysField("Upload keys of shot reference pictures for the direction."),
      sceneKeys: pictureKeysField("Upload keys of pictures of the location, set, or wardrobe."),
      cuts: cutsField(),
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
      template: templateField(),
    }),
    approvalDetail: videoApprovalDetail("captions"),
  }),
  defineModeTool({
    modeId: "edit",
    name: "quick_edit_video",
    whenToUse: [
      "They want one plain change to a video they uploaded: rotate it, flip it, resize it, loop it, or change its volume.",
      "mediaKey is that video. If you omit it, the attached video is used.",
      "Pass op and value together. rotate: 90, 180, 270. flip: horizontal, vertical. resize: 9:16:crop, 9:16:pad, 1:1:crop, 1:1:pad, 16:9:crop, 16:9:pad. loop: 2 to 5. volume: 0 (mute), 50, 150, 200.",
    ],
    avoidWhen: [
      "There is no video file. Do not invent one.",
      "They want captions. Use add_captions.",
      "They want to cut, reorder, or add layers. Open the editor instead.",
    ],
    inputSchema: z.object({
      mediaKey: mediaKeyField("Video upload key. Omit to use the attached video."),
      op: z.enum(EDIT_OPS).describe("The change to make."),
      opValue: z.string().trim().max(20).optional().describe("The setting for that change. Omit for its default."),
      template: templateField(),
    }),
    approvalDetail: (value) =>
      isEditOp(value.op) ? `${describeEdit(value.op, editValueFor(value.op, String(value.opValue ?? "")))} · ${EDIT_CREDITS} credits` : "Quick edit",
    examples: [{ request: "This clip is sideways, fix it.", input: { op: "rotate", opValue: "90" } }],
  }),
  defineModeTool({
    modeId: "direct",
    name: "make_direct_video",
    whenToUse: [
      "They wrote the exact prompt for the video model and want it sent untouched: no planning, no look, no voice, one clip.",
      "Pick the model with model (list_models). The length must be one that model films.",
    ],
    avoidWhen: [
      "They described an idea and want it planned into shots. Use make_prompt_video.",
      "They want narration or a character voice. Use make_voiceover_video or make_prompt_video.",
    ],
    inputSchema: z.object({
      prompt: promptField("The whole prompt for the video model. Sent exactly as written."),
      format: formatField(),
      length: lengthField(),
      tier: tierField(),
      model: modelField(),
      template: templateField(),
    }),
    approvalDetail: videoApprovalDetail("direct"),
    examples: [
      {
        request: "Send this exact prompt to Kling 4: 'macro shot of rain on a leaf, 4k'",
        input: { prompt: "macro shot of rain on a leaf, 4k", format: "9:16", length: 5, model: "kling-4" },
      },
    ],
  }),
  defineModeTool({
    modeId: "swap",
    name: "make_character_swap",
    whenToUse: [
      "They want their character in a video they uploaded. mediaKey is that video; omit it to use the attached one, but pass it when known so the price shows before approval.",
      "method replace (default) edits their video and keeps everything else. The prompt says what to replace, naming the character: 'Replace the monkey with Greg'.",
      "method moves makes a new clip of the character doing the video's moves. The scene is not kept.",
      "Pass characterId (and characterLookId), or one picture key in referenceKeys for someone not saved.",
      `To swap in several saved characters at once (replace only, up to ${MAX_SWAP_CHARACTERS}), pass cast and name each one in the prompt: 'Replace the monkey with Greg and the man with Dana'. With several, the video keeps its own voices.`,
      `Lengths: ${MIN_SWAP_SECONDS} to ${MAX_SWAP_TOTAL_SECONDS} seconds for now. For a longer video, pass keep with the parts to use (they are joined in order); ask the person which part they want if it isn't clear. The price follows the seconds used. Its sound is kept unless keepSound is false.`,
    ],
    avoidWhen: [
      "They want a new clip made from a description. Use make_prompt_video.",
      "They want a still animated. Use make_image_video.",
      "They want the character to say a script to camera. Use make_shorts_video or make_avatar_video.",
    ],
    inputSchema: z.object({
      mediaKey: mediaKeyField("Upload key of the performance video. Omit to use the attached video."),
      characterId: characterField(),
      characterLookId: characterLookField(),
      cast: z
        .array(
          z.object({
            characterId: z.string().trim().min(1).max(80).describe("A saved character's id from list_characters."),
            characterLookId: z.string().trim().max(80).optional().describe("One of that character's looks. Omit for their main picture."),
          }),
        )
        .min(1)
        .max(MAX_SWAP_CHARACTERS)
        .optional()
        .describe(`replace only: every saved character to swap in, up to ${MAX_SWAP_CHARACTERS}, each named in the prompt. Takes the place of characterId.`),
      referenceKeys: z
        .array(z.string().trim().min(1).max(200))
        .max(1)
        .optional()
        .describe("One picture key of who should appear, when they are not a saved character."),
      method: z
        .enum(SWAP_METHODS)
        .optional()
        .describe("replace edits their video and swaps in the character (15s per part). moves makes a new clip of the character doing the video's moves (30s per part). Longer videos are done in parts and joined. Defaults to replace."),
      prompt: z
        .string()
        .trim()
        .max(SWAP_PROMPT_LIMIT)
        .optional()
        .describe("For replace: what to replace, naming the character, e.g. 'Replace the monkey with Greg'. Empty replaces the main person. For moves: optional wardrobe or style notes."),
      orientation: z
        .enum(SWAP_ORIENTATIONS)
        .optional()
        .describe("moves only. video follows the video's framing, 30s per part. image keeps the picture's framing, 10s per part. Defaults to video."),
      keep: z
        .array(z.object({ start: z.number().min(0), end: z.number().positive() }))
        .max(20)
        .optional()
        .describe(`Parts of the video to use, in seconds, in order and not overlapping, e.g. [{"start": 2, "end": 9}]. They are joined into one clip. Use it to cut a longer video down: together they must be ${MIN_SWAP_SECONDS} to ${MAX_SWAP_TOTAL_SECONDS} seconds. Leave it out to use the whole video.`),
      keepSound: z.boolean().optional().describe("Keep the video's own sound. Defaults to true."),
      characterVoice: z
        .boolean()
        .optional()
        .describe("Re-voice the speech in the video in the character's own voice, keeping the words and timing. Defaults to true. Needs the character to have a voice and keepSound to be true."),
      tier: tierField(),
    }),
    approvalDetail: (input) => {
      const parts = [
        input.method === "moves" ? "Character swap, copying the moves" : "Character swap, replacing in the video",
        swapResolutionFor(typeof input.tier === "string" ? input.tier : undefined),
      ];
      if (input.method === "moves" && input.orientation === "image") parts.push("picture framing");
      if (input.keepSound === false) parts.push("no sound");
      else if (input.characterVoice === false) parts.push("original voice");
      return parts.join(" · ");
    },
    examples: [
      {
        request: "Replace the monkey in this video with Greg.",
        input: { mediaKey: "uploads/u1/street.mp4", characterId: "c-1", prompt: "Replace the monkey with Greg", tier: "pro" },
      },
      {
        request: "Have my character do the dance in this video.",
        input: { mediaKey: "uploads/u1/dance.mp4", characterId: "c-1", method: "moves", tier: "pro" },
      },
    ],
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
      "Set voiceover to false when they want no spoken lines. Omit it so the plan keeps its voices.",
      "Pass hints to fix the scene count, scene lengths, music, sfx, ambience, narrator voice, transitions, or model.",
      "After planning, get_production shows every shot and sound; the production_* tools change them before approve_production.",
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
      characterLookId: characterLookField(),
      voiceover: z
        .boolean()
        .optional()
        .describe("Set false when they want no spoken voiceover. Omit to keep the voices written into the plan."),
      creativeDelegation: z
        .boolean()
        .optional()
        .describe("True lets the planner make creative calls on its own instead of asking. Defaults to false."),
      budgetUsd: z.number().positive().max(500).optional().describe("Spend cap in US dollars for filming, up to 500. Omit for no cap."),
      referenceKeys: referenceKeysField(),
      hints: productionHintsField(),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: (input) => {
      const parts = [String(input.format ?? "9:16"), `${String(input.durationSec ?? 30)}s`];
      if (typeof input.characterId === "string" && input.characterId && input.characterId !== "off") parts.push("character");
      if (input.voiceover === false) parts.push("no voiceover");
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

/** Applied to a finished video, so it is its own tool, not a Create mode. */
export const layoutTools = [
  defineTool({
    name: "apply_layout_style",
    title: "Apply a layout style",
    category: "make",
    summary:
      "Re-edit a finished Talking Avatar or UGC video in a layout style, the way Shorts creators cut. Its own take is reused, so nothing is filmed again. Spends credits for the pictures it draws.",
    whenToUse: [
      "They have a finished Talking Avatar or UGC video and want it edited like a creator's Short: split screen, punch-ins, a bubble over a screenshot, and so on.",
      "Styles: split-presenter (picture over speaker), punch-in (close-ups and cutaways), source-reader (a post with the speaker in a bubble; needs a post), framed-post (name, headline, band, end card), screen-demo (screen in a window; needs a recording or screenshot), sketch-explainer (drawn charts on paper; any video with a voice).",
      "Pass media for files they uploaded for it: role post or screenshot for pictures of a post or page, recording for a screen recording, picture for any other photo. Uploads are shown before anything is drawn, and each one lowers the price.",
      "The result is a new video, linked to the original, that opens in the editor with every layer.",
    ],
    avoidWhen: [
      "They want a new video. Use make_avatar_video or make_ugc_video first, then this.",
      "The video is not a Talking Avatar or UGC video, and the style is not sketch-explainer. Only those videos have one take of the speaker to cut.",
    ],
    inputSchema: z.object({
      videoId: z.string().trim().uuid().describe("The finished Talking Avatar or UGC video to lay out."),
      style: z.enum(LAYOUT_STYLE_IDS).describe("The layout style."),
      media: z
        .array(
          z.object({
            key: z.string().trim().min(1).max(200).describe("Upload key."),
            role: z.enum(LAYOUT_MEDIA_ROLES).describe("post, screenshot, recording, or picture."),
            note: z.string().trim().max(300).optional().describe("What it shows, in their words. Optional."),
          }),
        )
        .max(12)
        .optional()
        .describe("Files they uploaded to show in the video. Omit when there are none."),
      showText: z.boolean().optional().describe("Captions on or off. Defaults to on."),
    }),
    effects: { readOnly: false, spendsCredits: true, destructive: false, longRunning: true },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: (input) => `layout · ${String(input.style ?? "")}${Array.isArray(input.media) && input.media.length ? ` · ${input.media.length} uploads` : ""}`,
    examples: [
      {
        request: "Turn my last UGC video into a split-screen Short.",
        input: { videoId: "929490c0-0f4b-4c91-a5b9-4fe5115e9480", style: "split-presenter" },
      },
    ],
  }),
];
