import { z } from "zod";
import {
  AUDIO_ROLES,
  FIT_MODES,
  IMAGE_MOTIONS,
  TEXT_ALIGNS,
  TEXT_ANIMATIONS,
  TRACK_KINDS,
  TRANSITION_TYPES,
} from "@/lib/editor/schema";
import { defineTool } from "@/lib/tools/define";
import { idField } from "@/lib/tools/fields";
import { VIDEO_FORMATS } from "@/lib/video/schema";

/** Edit tools that edit_batch can run. They change only the timeline and need no media lookup. */
export const BATCHABLE_EDITS = [
  "edit_add_text",
  "edit_update_text",
  "edit_trim",
  "edit_split",
  "edit_remove",
  "edit_move",
  "edit_set_volume",
  "edit_set_project",
  "edit_add_track",
  "edit_update_track",
  "edit_remove_track",
  "edit_reorder_track",
  "edit_duplicate",
  "edit_crossfade",
  "edit_set_transition",
  "edit_set_transform",
  "edit_style_text",
  "edit_style_captions",
  "edit_remove_captions",
  "edit_set_audio",
  "edit_set_image_motion",
] as const;

const projectField = () =>
  idField("Editor project id. Omit it in this chat; the open project is used.").optional();

const positionField = () =>
  z.enum(["top", "center", "bottom"]).optional().describe("Where the words sit: top, center, or bottom.");

const oneClip =
  "The finished video is one clip. Split it, then remove the piece you do not want.";

const free = { readOnly: false, spendsCredits: false, destructive: false, longRunning: false } as const;

export const timelineEditTools = [
  defineTool({
    name: "edit_read_timeline",
    title: "Read the timeline",
    category: "editor",
    summary:
      "List the tracks and clips in the open project, with ids and times in seconds. The sound field says whether a Voiceover clip was added after filming.",
    whenToUse: [
      "Before any edit, so you use real clip ids.",
      "When they ask what is on the timeline, or where a voice is coming from.",
    ],
    inputSchema: z.object({
      projectId: projectField(),
      detail: z
        .boolean()
        .optional()
        .describe("True adds every clip property (transform, opacity, text style, transitions, fades, trim) and the media list."),
    }),
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "edit_add_text",
    title: "Add text",
    category: "editor",
    summary: "Add a title or caption on the text track. Free.",
    whenToUse: ["They want words on screen, such as a title at the start."],
    avoidWhen: ["They want spoken captions for the whole video. Use edit_add_captions."],
    inputSchema: z.object({
      projectId: projectField(),
      text: z.string().trim().min(1).max(200).describe("The words on screen."),
      startSec: z.number().min(0).optional().describe("When the words appear, in seconds. Defaults to 0."),
      endSec: z.number().min(0).optional().describe("When the words leave, in seconds. Defaults to 3 seconds later."),
      position: positionField(),
    }),
    effects: free,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "edit_update_text",
    title: "Update text",
    category: "editor",
    summary: "Change the words or the position of a text clip. Free.",
    whenToUse: ["A title is already on the timeline and they want different words or placement."],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Text clip id from edit_read_timeline."),
      text: z.string().trim().min(1).max(200).optional().describe("Replacement words."),
      position: positionField(),
    }),
    effects: free,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "edit_trim",
    title: "Trim a clip",
    category: "editor",
    summary: `Move a clip's start or end. Free. ${oneClip}`,
    whenToUse: ["They want the video shorter, or a title to end sooner."],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Clip id from edit_read_timeline."),
      startSec: z.number().min(0).optional().describe("New start, in seconds."),
      endSec: z.number().min(0).optional().describe("New end, in seconds."),
    }),
    effects: free,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "edit_split",
    title: "Split a clip",
    category: "editor",
    summary: `Cut one clip into two at a time. Free. ${oneClip}`,
    whenToUse: ["They want to drop or move part of the video, not the whole clip."],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Clip id from edit_read_timeline."),
      atSec: z.number().min(0).describe("Where to cut, in seconds, inside the clip."),
    }),
    effects: free,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "edit_remove",
    title: "Remove a clip",
    category: "editor",
    summary: `Delete a clip. Free. ${oneClip}`,
    whenToUse: [
      "They want a title, a song, a Voiceover clip, or a split piece gone.",
      "They want a voice that was added after filming taken off. Remove the Voiceover clip. That is free.",
    ],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Clip id from edit_read_timeline."),
      ripple: z.boolean().optional().describe("When true, later clips on that track slide left to close the gap."),
    }),
    effects: free,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "edit_move",
    title: "Move a clip",
    category: "editor",
    summary: "Slide a clip to a new start time, or onto another track of the same kind. Free.",
    whenToUse: ["They want a title or song to start later or earlier.", "They want a clip on a different layer. Pass trackId."],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Clip id from edit_read_timeline."),
      startSec: z.number().min(0).optional().describe("New start, in seconds. Omit to keep the start when only changing track."),
      trackId: idField("Track to move it onto. Must be the same kind (visual, text, audio).").optional(),
    }),
    effects: free,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "edit_add_music",
    title: "Add music",
    category: "editor",
    summary: "Lay a song, a sound effect, or an attached audio file on the audio track. Free.",
    whenToUse: [
      "They want music under the cut. Use a song id, an upload key, or the attached audio.",
      "They want a sound effect at a moment. Pass role sfx, startSec, and the upload key; sfx defaults to full volume and no fades.",
    ],
    avoidWhen: ["They want a new music video from scratch. Use make_music_video."],
    inputSchema: z.object({
      projectId: projectField(),
      songId: idField("Song id from list_songs or compose_song.").optional(),
      mediaKey: z.string().trim().min(1).optional().describe("Upload key for an audio file. Omit to use the attached audio."),
      startSec: z.number().min(0).optional().describe("When the song starts, in seconds. Defaults to 0."),
      volume: z.number().min(0).max(2).optional().describe("Loudness from 0 to 2. Defaults to 0.35."),
      fadeInSec: z.number().min(0).optional().describe("Fade in, in seconds."),
      fadeOutSec: z.number().min(0).optional().describe("Fade out, in seconds."),
      seconds: z.number().positive().optional().describe("Length when the file's length is unknown."),
      role: z.enum(["music", "sfx"]).optional().describe("music (default) or sfx."),
      durationSec: z.number().positive().optional().describe("Play only this many seconds of it."),
    }),
    effects: free,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "edit_set_volume",
    title: "Set volume",
    category: "editor",
    summary:
      "Change a clip's volume, or mute a track. Free. Turn down the Voiceover clip, or set an older mixed video clip to 0.",
    whenToUse: [
      "The song or the Voiceover clip is too loud, or they want a track silent.",
      "sound.kind is mixed. Set sound.videoItemId to volume 0. That silences the whole older clip.",
    ],
    avoidWhen: ["They want the voice gone and a Voiceover clip is on the Audio track. Use edit_remove. Do not start a new video."],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Audio or video clip id.").optional(),
      trackId: idField("Track id to mute or unmute.").optional(),
      volume: z.number().min(0).max(2).optional().describe("Loudness from 0 to 2."),
      muted: z.boolean().optional().describe("With trackId: true mutes, false unmutes. Defaults to true."),
    }),
    effects: free,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  defineTool({
    name: "edit_add_captions",
    title: "Add captions",
    category: "editor",
    summary: "Put the spoken words on screen as timed text. Uses the video's script, or a transcript. Free.",
    whenToUse: ["They want captions on the open project."],
    avoidWhen: ["There is no project yet. add_captions makes a new captioned video and spends credits."],
    inputSchema: z.object({ projectId: projectField() }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: true },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
];

const textStyleFields = () => ({
  fontFamily: z.string().trim().min(1).max(80).optional().describe("CSS font family, e.g. Inter, Georgia, Impact."),
  fontSize: z.number().min(8).max(400).optional().describe("Size in pixels on the full-size frame. Titles 60-110, captions 36-48."),
  fontWeight: z.number().int().min(100).max(900).optional().describe("100 thin to 900 black. 700 is bold."),
  color: z.string().trim().max(40).optional().describe("Text color, e.g. #FFFFFF or rgb(255,200,0)."),
  background: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .optional()
    .describe("Box behind the words, e.g. rgba(0,0,0,0.55). null removes the box."),
  align: z.enum(TEXT_ALIGNS).optional().describe("left, center, or right."),
  position: positionField(),
  animationIn: animationField("How the words appear."),
  animationOut: animationField("How the words leave."),
});

const animationField = (description: string) =>
  z
    .object({
      type: z.enum(TEXT_ANIMATIONS).describe("none, fade, or slide."),
      seconds: z.number().min(0).max(3).optional().describe("Length of the animation."),
    })
    .optional()
    .describe(description);

const editTool = (definition: {
  name: string;
  title: string;
  summary: string;
  whenToUse: string[];
  avoidWhen?: string[];
  inputSchema: z.ZodType;
}) =>
  defineTool({
    ...definition,
    category: "editor",
    effects: free,
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  });

export const moreEditTools = [
  editTool({
    name: "edit_set_project",
    title: "Rename or reshape",
    summary: "Rename the project or change its frame (9:16, 1:1, 16:9). Free.",
    whenToUse: ["They want a different title or aspect ratio for the edit."],
    inputSchema: z.object({
      projectId: projectField(),
      title: z.string().trim().min(1).max(120).optional().describe("New project title."),
      format: z.enum(VIDEO_FORMATS).optional().describe("New frame. Clips keep their framing; check with edit_read_timeline."),
    }),
  }),
  editTool({
    name: "edit_add_track",
    title: "Add a track",
    summary: "Add a visual, text, or audio track (a layer). Free.",
    whenToUse: ["They want another layer: a picture-in-picture, a second title row, or music and sound effects on separate lanes."],
    inputSchema: z.object({
      projectId: projectField(),
      kind: z.enum(TRACK_KINDS).describe("visual for video and pictures, text for titles, audio for sound."),
      name: z.string().trim().max(60).optional().describe("Track name."),
      index: z.number().int().min(0).optional().describe("Position in the track list, 0 first. Omit to add at the end."),
    }),
  }),
  editTool({
    name: "edit_update_track",
    title: "Update a track",
    summary: "Rename a track, or mute, hide, lock, or unlock it. Free.",
    whenToUse: [
      "They want a layer silent, invisible, or protected from changes.",
      "An edit failed with \"This track is locked.\" Unlock it first, if they agree.",
    ],
    inputSchema: z.object({
      projectId: projectField(),
      trackId: idField("Track id from edit_read_timeline."),
      name: z.string().trim().max(60).optional().describe("New name."),
      muted: z.boolean().optional().describe("Silence an audio track."),
      hidden: z.boolean().optional().describe("Hide a visual or text track."),
      locked: z.boolean().optional().describe("Lock or unlock the track."),
    }),
  }),
  editTool({
    name: "edit_remove_track",
    title: "Remove a track",
    summary: "Delete a track and every clip on it. Free; edit_undo brings it back.",
    whenToUse: ["They want a whole layer gone."],
    avoidWhen: ["They want one clip gone. Use edit_remove."],
    inputSchema: z.object({ projectId: projectField(), trackId: idField("Track id from edit_read_timeline.") }),
  }),
  editTool({
    name: "edit_reorder_track",
    title: "Reorder a track",
    summary: "Move a track up or down the list. Later visual tracks draw on top. Free.",
    whenToUse: ["A layer should sit above or below another."],
    inputSchema: z.object({
      projectId: projectField(),
      trackId: idField("Track id from edit_read_timeline."),
      index: z.number().int().min(0).describe("New position, 0 first."),
    }),
  }),
  editTool({
    name: "edit_duplicate",
    title: "Duplicate a clip",
    summary: "Copy a clip. The copy goes right after the original unless you say where. Free.",
    whenToUse: ["They want a clip, title, or sound repeated."],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Clip id from edit_read_timeline."),
      startSec: z.number().min(0).optional().describe("Where the copy starts."),
      trackId: idField("Track for the copy, same kind.").optional(),
    }),
  }),
  editTool({
    name: "edit_crossfade",
    title: "Crossfade two clips",
    summary: "Overlap two clips on the same track with a fade between them. Free.",
    whenToUse: ["They want a smooth blend from one clip into the next."],
    inputSchema: z.object({
      projectId: projectField(),
      firstId: idField("The earlier clip."),
      secondId: idField("The later clip."),
      seconds: z.number().min(0.03).max(3).optional().describe("Overlap length. Defaults to 0.4."),
    }),
  }),
  editTool({
    name: "edit_set_transition",
    title: "Set a transition",
    summary: "Set how a clip enters or leaves: fade, slide, wipe, zoom, or none. Free.",
    whenToUse: ["They want a clip, picture, scene, or title to fade, slide, wipe, or zoom in or out."],
    avoidWhen: ["It is an audio clip. Use edit_set_audio fades.", "Two clips should blend into each other. Use edit_crossfade."],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Clip id from edit_read_timeline."),
      type: z.enum([...TRANSITION_TYPES, "none"]).describe("fade, slide, wipe, zoom, or none to remove it."),
      edge: z.enum(["in", "out", "both"]).optional().describe("Which end. Defaults to both."),
      seconds: z.number().min(0.03).max(3).optional().describe("Length. Defaults to 0.4."),
    }),
  }),
  editTool({
    name: "edit_set_transform",
    title: "Position and size",
    summary: "Move, scale, rotate, fit, or fade a video, picture, or text clip on the frame. Free.",
    whenToUse: [
      "They want a picture-in-picture, a zoomed crop, a tilt, or a semi-transparent overlay.",
      "fillFrame true resets to centred, full size, unrotated.",
    ],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Clip id from edit_read_timeline."),
      x: z.number().min(-200).max(200).optional().describe("Horizontal offset, percent of the frame width. 0 is centred."),
      y: z.number().min(-200).max(200).optional().describe("Vertical offset, percent of the frame height. 0 is centred, negative is up."),
      scale: z.number().min(0.05).max(10).optional().describe("Size. 1 fills the frame; 0.4 is a small inset. Video never shrinks below 1."),
      rotation: z.number().min(-360).max(360).optional().describe("Degrees clockwise."),
      fit: z.enum(FIT_MODES).optional().describe("cover crops to fill, contain shows the whole picture."),
      opacity: z.number().min(0).max(1).optional().describe("0 invisible to 1 solid. Not for text."),
      fillFrame: z.boolean().optional().describe("Reset position, size, and rotation first."),
    }),
  }),
  editTool({
    name: "edit_style_text",
    title: "Style text",
    summary: "Change the font, size, weight, color, box, alignment, position, and in/out animation of one or more text clips. Free.",
    whenToUse: ["They want titles bigger, bolder, a different color or font, without a box, or animated differently."],
    avoidWhen: ["They want every caption restyled. Use edit_style_captions."],
    inputSchema: z.object({
      projectId: projectField(),
      itemIds: z.array(z.string().trim().min(1)).min(1).max(200).describe("Text clip ids from edit_read_timeline."),
      ...textStyleFields(),
    }),
  }),
  editTool({
    name: "edit_style_captions",
    title: "Style captions",
    summary: "Restyle every caption at once: font, size, color, box, position, animation. Free.",
    whenToUse: ["They want the captions bigger, higher, yellow, without a box, and so on."],
    inputSchema: z.object({ projectId: projectField(), ...textStyleFields() }),
  }),
  editTool({
    name: "edit_remove_captions",
    title: "Remove captions",
    summary: "Delete every caption, keeping other titles. Free; edit_undo brings them back.",
    whenToUse: ["They want the captions gone, or want to add them again with a different style."],
    inputSchema: z.object({ projectId: projectField() }),
  }),
  editTool({
    name: "edit_set_audio",
    title: "Set sound",
    summary: "Change a clip's volume, an audio clip's fade in and out, or mark it as music, sfx, or voice. Free.",
    whenToUse: ["The music should fade out at the end, a sound effect is too quiet, or the voice should duck."],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Audio or video clip id from edit_read_timeline."),
      volume: z.number().min(0).max(2).optional().describe("0 silent, 1 as recorded, 2 double."),
      fadeInSec: z.number().min(0).max(30).optional().describe("Audio clips only."),
      fadeOutSec: z.number().min(0).max(30).optional().describe("Audio clips only."),
      role: z.enum(AUDIO_ROLES).optional().describe("music, sfx, or voice. Audio clips only."),
    }),
  }),
  editTool({
    name: "edit_set_image_motion",
    title: "Camera move on a picture",
    summary: "Give a still picture a slow zoom or pan, or stop it. Free.",
    whenToUse: ["A picture clip should feel alive: Ken Burns zoom in, pan left, and so on."],
    inputSchema: z.object({
      projectId: projectField(),
      itemId: idField("Picture clip id from edit_read_timeline."),
      motion: z.enum([...IMAGE_MOTIONS, "none"]).describe("The move, or none."),
      amount: z.number().min(0).max(0.5).optional().describe("How far it travels, as a share of the frame. Defaults to 0.12."),
    }),
  }),
  defineTool({
    name: "edit_add_media",
    title: "Add a picture, clip, or sound",
    category: "editor",
    summary: "Put an uploaded picture, video, or audio file, or one of their finished videos, on the timeline. Free.",
    whenToUse: [
      "They want a B-roll clip, a logo, a picture, or a sound placed at a time.",
      "Get a key with list_uploads or import_media_from_url, or a videoId from list_my_videos.",
    ],
    avoidWhen: ["It is a song or background music. edit_add_music sets music defaults."],
    inputSchema: z.object({
      projectId: projectField(),
      mediaKey: z.string().trim().min(1).max(200).optional().describe("Upload key of a picture, video, or audio file."),
      videoId: idField("A finished video from list_my_videos, placed as a clip.").optional(),
      startSec: z.number().min(0).optional().describe("Where it starts. Defaults to 0."),
      durationSec: z.number().positive().max(600).optional().describe("How long it shows. Pictures default to 3 s; clips and sounds to their length."),
      trackId: idField("Track to put it on. Defaults to the first unlocked track of the right kind.").optional(),
      role: z.enum(AUDIO_ROLES).optional().describe("For audio: music, sfx, or voice."),
    }),
    effects: { readOnly: false, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  editTool({
    name: "edit_batch",
    title: "Several edits at once",
    summary: "Apply a list of edits in order as one change, so they land together and undo together. Free.",
    whenToUse: [
      "You have several edits planned, e.g. trim three clips and restyle the titles.",
      "Each op names an edit tool and its arguments, without projectId.",
    ],
    avoidWhen: ["The edits need media lookups (music, media, captions). Call those tools on their own."],
    inputSchema: z.object({
      projectId: projectField(),
      ops: z
        .array(
          z.object({
            tool: z.enum(BATCHABLE_EDITS).describe("The edit tool to run."),
            args: z.record(z.string(), z.unknown()).describe("That tool's arguments, without projectId."),
          }),
        )
        .min(1)
        .max(100)
        .describe("Edits to apply, in order. If any fails, none are saved."),
    }),
  }),
  editTool({
    name: "edit_undo",
    title: "Undo the last edit",
    summary: "Put the timeline back to how it was before the last agent edit. Free.",
    whenToUse: ["They don't like the last change, or an edit went wrong."],
    avoidWhen: ["They want an older version. Use edit_list_revisions and edit_restore_revision."],
    inputSchema: z.object({ projectId: projectField() }),
  }),
  defineTool({
    name: "edit_list_revisions",
    title: "List edit history",
    category: "editor",
    summary: "List saved versions of the timeline, newest first, with what changed. Free.",
    whenToUse: ["They want to go back further than one undo, or see what changed."],
    inputSchema: z.object({ projectId: projectField() }),
    effects: { readOnly: true, spendsCredits: false, destructive: false, longRunning: false },
    approval: "none",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
  }),
  editTool({
    name: "edit_restore_revision",
    title: "Restore a version",
    summary: "Put back a saved version from edit_list_revisions. The current timeline is kept as a version too. Free.",
    whenToUse: ["They want the edit as it was at an earlier point."],
    inputSchema: z.object({ projectId: projectField(), revisionId: idField("Revision id from edit_list_revisions.") }),
  }),
  defineTool({
    name: "edit_revert_to_original",
    title: "Revert to the original",
    category: "editor",
    summary: "Throw away every edit and rebuild the timeline from the source video. edit_undo can still bring the edits back.",
    whenToUse: ["They want to start the edit over from the generated video."],
    inputSchema: z.object({ projectId: projectField() }),
    effects: { readOnly: false, spendsCredits: false, destructive: true, longRunning: false },
    approval: "user",
    runsOn: "server",
    surfaces: ["coach", "mcp"],
    approvalDetail: () => "Every edit is replaced with the original video",
  }),
];
