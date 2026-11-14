import { z } from "zod";
import { MAX_CHARACTER_NAME } from "@/lib/characters/constants";
import {
  MAX_CAPTION,
  MAX_CHARACTER_CLIPS,
  MAX_CHARACTER_IMAGES,
  MAX_DESCRIPTION,
  MAX_LOOK_NAME,
  MAX_PERSONALITY,
  MAX_SPEAKING_STYLE,
  MAX_WARDROBE,
  MEDIA_LABELS,
} from "@/lib/characters/media";
import { defineTool } from "@/lib/tools/define";
import { idField } from "@/lib/tools/fields";

const characterId = () => idField("Character id from list_characters.");
const free = { readOnly: false, spendsCredits: false, destructive: false, longRunning: false } as const;
const label = () =>
  z
    .enum(MEDIA_LABELS)
    .optional()
    .describe("What the picture shows: face, profile, full_body, expression, outfit, or other. Face pictures matter most.");
const lookId = () =>
  z.string().trim().max(80).nullable().optional().describe("Look id from get_character, or null for no look.");

const characterTool = (definition: { name: string; title: string; summary: string; whenToUse: string[]; avoidWhen?: string[]; inputSchema: z.ZodType }) =>
  defineTool({ ...definition, category: "assets", effects: free, approval: "none", runsOn: "server", surfaces: ["coach", "mcp"] });

export const characterTools = [
  defineTool({
    name: "get_character",
    title: "Read a character",
    category: "library",
    summary: "Everything about one character: description, personality, speaking style, voice, looks, and every picture and clip with ids and labels.",
    whenToUse: [
      "Before editing a character, or to pick a look or check which pictures a video will use.",
      "Pictures are sent to video models face first; the main picture always leads.",
    ],
    inputSchema: z.object({ characterId: characterId() }),
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  characterTool({
    name: "update_character",
    title: "Update a character",
    summary: "Rename a character or change its written description, personality, or speaking style. Free.",
    whenToUse: [
      "They describe how the person looks, acts, or talks. The description goes into every shot prompt, so keep it visual and specific.",
    ],
    inputSchema: z.object({
      characterId: characterId(),
      name: z.string().trim().min(2).max(MAX_CHARACTER_NAME).optional().describe("New name."),
      description: z.string().trim().max(MAX_DESCRIPTION).optional().describe("Appearance: age, build, hair, face, skin, distinguishing features. Empty clears it."),
      personality: z.string().trim().max(MAX_PERSONALITY).optional().describe("How they act and behave. Empty clears it."),
      speakingStyle: z.string().trim().max(MAX_SPEAKING_STYLE).optional().describe("How they talk: tone, pace, vocabulary. Empty clears it."),
    }),
  }),
  characterTool({
    name: "character_add_media",
    title: "Add pictures or clips",
    summary: `Add uploaded pictures and short clips to a character (up to ${MAX_CHARACTER_IMAGES} pictures and ${MAX_CHARACTER_CLIPS} clips of 20 seconds). Free.`,
    whenToUse: [
      "They give more photos or a clip of the person: more angles keep the face consistent.",
      "Get keys from list_uploads or import_media_from_url. Label each picture so the best ones are sent first.",
    ],
    inputSchema: z.object({
      characterId: characterId(),
      items: z
        .array(
          z.object({
            key: z.string().trim().min(1).max(200).describe("Upload key of a picture or a video clip."),
            label: label(),
            lookId: lookId(),
            caption: z.string().trim().max(MAX_CAPTION).optional().describe("A short note on what it shows."),
            durationSec: z.number().positive().max(60).optional().describe("Clip length, if you know it."),
          }),
        )
        .min(1)
        .max(30)
        .describe("Pictures and clips to add."),
    }),
  }),
  characterTool({
    name: "character_update_media",
    title: "Change a picture or clip",
    summary: "Relabel a character's picture or clip, move it to a look, caption it, or make a picture the main one. Free.",
    whenToUse: ["A picture is labelled wrong, belongs to a look, or should be the main picture."],
    inputSchema: z.object({
      characterId: characterId(),
      mediaId: idField("Picture or clip id from get_character."),
      label: label(),
      lookId: lookId(),
      caption: z.string().trim().max(MAX_CAPTION).optional().describe("A short note on what it shows."),
      main: z.boolean().optional().describe("true makes this picture the main one, sent first in every video."),
    }),
  }),
  characterTool({
    name: "character_remove_media",
    title: "Remove a picture or clip",
    summary: "Take a picture or clip off a character. The upload itself stays. Free.",
    whenToUse: ["A picture is blurry, wrong, or someone else."],
    inputSchema: z.object({ characterId: characterId(), mediaId: idField("Picture or clip id from get_character.") }),
  }),
  characterTool({
    name: "character_add_look",
    title: "Add a look",
    summary: "Add a named look (an outfit or style, like Office or Gym) with a wardrobe note. Free.",
    whenToUse: ["The person appears in different outfits. A video then picks one look with characterLookId."],
    inputSchema: z.object({
      characterId: characterId(),
      name: z.string().trim().min(2).max(MAX_LOOK_NAME).describe("Short name, like Office."),
      wardrobe: z.string().trim().max(MAX_WARDROBE).optional().describe("What they wear in this look."),
    }),
  }),
  characterTool({
    name: "character_update_look",
    title: "Change a look",
    summary: "Rename a look or change its wardrobe note. Free.",
    whenToUse: ["The outfit description needs to change."],
    inputSchema: z.object({
      characterId: characterId(),
      lookId: idField("Look id from get_character."),
      name: z.string().trim().min(2).max(MAX_LOOK_NAME).optional().describe("New name."),
      wardrobe: z.string().trim().max(MAX_WARDROBE).optional().describe("What they wear in this look."),
    }),
  }),
  characterTool({
    name: "character_remove_look",
    title: "Remove a look",
    summary: "Delete a look. Its pictures stay on the character with no look. Free.",
    whenToUse: ["They no longer use that outfit."],
    inputSchema: z.object({ characterId: characterId(), lookId: idField("Look id from get_character.") }),
  }),
];
