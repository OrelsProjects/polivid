import { z } from "zod";
import { VIDEO_FORMATS } from "@/lib/video/schema";
import {
  AUDIO_TRACKS,
  CONTINUITY_KINDS,
  INPUT_CLASSES,
  NATIVE_AUDIO_POLICIES,
  PROVENANCE,
  REFERENCE_ROLES,
  SPEECH_MODES,
} from "./enums";

export const ProvenanceSchema = z.enum(PROVENANCE);

export const ProvenancedTextSchema = z.object({
  value: z.string(),
  provenance: ProvenanceSchema,
});

export const ProvenancedStringListSchema = z.object({
  values: z.array(z.string()),
  provenance: ProvenanceSchema,
});

export const AttachmentSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  mime: z.string(),
  kind: z.enum(["document", "image", "audio", "video", "other"]),
  text: z.string().nullable(),
  /** Storage key of the uploaded file, for pictures and media the pipeline reads back. */
  key: z.string().nullable().optional(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

export const InputRecordSchema = z.object({
  text: z.string(),
  attachments: z.array(AttachmentSchema),
  classification: z.enum(INPUT_CLASSES).nullable(),
});
export type InputRecord = z.infer<typeof InputRecordSchema>;

export const ExactDialogueSchema = z.object({
  speaker: z.string(),
  line: z.string(),
  provenance: ProvenanceSchema,
});
export type ExactDialogue = z.infer<typeof ExactDialogueSchema>;

export const RequiredEventSchema = z.object({
  id: z.string().min(1),
  description: z.string(),
  provenance: ProvenanceSchema,
});
export type RequiredEvent = z.infer<typeof RequiredEventSchema>;

export const FactualClaimSchema = z.object({
  id: z.string().min(1),
  claim: z.string(),
  provenance: ProvenanceSchema,
});
export type FactualClaim = z.infer<typeof FactualClaimSchema>;

export const RequirementsSchema = z.object({
  subject: ProvenancedTextSchema,
  purpose: ProvenancedTextSchema,
  audience: ProvenancedTextSchema,
  durationSec: z.object({ value: z.number().positive(), provenance: ProvenanceSchema }),
  format: z.object({ value: z.enum(VIDEO_FORMATS), provenance: ProvenanceSchema }),
  language: ProvenancedTextSchema,
  tone: ProvenancedTextSchema,
  requiredEvents: z.array(RequiredEventSchema),
  exactDialogue: z.array(ExactDialogueSchema),
  factualClaims: z.array(FactualClaimSchema),
  ending: ProvenancedTextSchema,
  suppliedAssets: ProvenancedStringListSchema,
  creativeFreedom: ProvenancedTextSchema,
});
export type Requirements = z.infer<typeof RequirementsSchema>;

export const AssumptionSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  material: z.boolean(),
});
export type Assumption = z.infer<typeof AssumptionSchema>;

export const QuestionSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  whyItMatters: z.string(),
  options: z.array(z.string()).min(1),
  answer: z.string().nullable(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const ProposedAdditionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["betrayal", "romance", "new_character", "product_claim", "surprise_ending", "other"]),
  text: z.string(),
  accepted: z.boolean().nullable(),
});
export type ProposedAddition = z.infer<typeof ProposedAdditionSchema>;

export const CreativeBriefSchema = z.object({
  visualStyle: z.string(),
  colorPalette: z.string(),
  lighting: z.string(),
  texture: z.string(),
  cameraBehavior: z.string(),
  performanceStyle: z.string(),
  pacing: z.string(),
  music: z.string(),
  ambience: z.string(),
  emotionalProgression: z.string(),
  summary: z.string(),
});
export type CreativeBrief = z.infer<typeof CreativeBriefSchema>;

export const ScriptSceneSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
  heading: z.string(),
  who: z.array(z.string()),
  where: z.string(),
  when: z.string(),
  action: z.string(),
  change: z.string(),
  viewerShould: z.string(),
  dialogue: z.array(z.object({ speaker: z.string(), line: z.string() })),
  estimatedSec: z.number().positive(),
});
export type ScriptScene = z.infer<typeof ScriptSceneSchema>;

export const ScriptSchema = z.object({
  title: z.string(),
  logline: z.string(),
  language: z.string(),
  scenes: z.array(ScriptSceneSchema).min(1),
});
export type Script = z.infer<typeof ScriptSchema>;

export const VoiceIdentitySchema = z.object({
  provider: z.string(),
  model: z.string(),
  voiceId: z.string(),
  language: z.string(),
  pronunciation: z.string().nullable(),
  deliveryBaseline: z.string(),
});
export type VoiceIdentity = z.infer<typeof VoiceIdentitySchema>;

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  appearance: z.string(),
  clothing: z.string(),
  distinguishingFeatures: z.string(),
  voice: VoiceIdentitySchema,
  performanceDirection: z.string(),
  referenceAssetIds: z.array(z.string()),
});
export type Character = z.infer<typeof CharacterSchema>;

export const LocationSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  timeOfDay: z.string(),
  weather: z.string(),
  lighting: z.string(),
  layout: z.string(),
  props: z.array(z.string()),
  referenceAssetIds: z.array(z.string()),
});
export type Location = z.infer<typeof LocationSchema>;

export const PropSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  description: z.string(),
  referenceAssetIds: z.array(z.string()),
});
export type Prop = z.infer<typeof PropSchema>;

export const SceneRecordSchema = z.object({
  id: z.string().min(1),
  scriptSceneId: z.string(),
  locationId: z.string(),
  characterIds: z.array(z.string()),
  time: z.string(),
  weather: z.string(),
  lighting: z.string(),
  layout: z.string(),
  props: z.array(z.string()),
  emotionalSituation: z.string(),
  purpose: z.string(),
});
export type SceneRecord = z.infer<typeof SceneRecordSchema>;

export const ShotRefSchema = z.object({
  targetId: z.string(),
  targetKind: z.enum(["character", "location", "prop", "reference", "asset"]),
  role: z.enum(REFERENCE_ROLES),
});
export type ShotRef = z.infer<typeof ShotRefSchema>;

export const BoundaryStateSchema = z.object({
  position: z.string(),
  direction: z.string(),
  speed: z.string(),
  gaze: z.string(),
  camera: z.string(),
  props: z.array(z.string()),
  incompleteAction: z.string().nullable(),
});
export type BoundaryState = z.infer<typeof BoundaryStateSchema>;

export const ShotSchema = z.object({
  id: z.string().min(1),
  sceneId: z.string(),
  order: z.number().int().min(0),
  purpose: z.string(),
  editDurationSec: z.number().positive(),
  generationDurationSec: z.number().positive(),
  characterIds: z.array(z.string()),
  propIds: z.array(z.string()),
  refs: z.array(ShotRefSchema),
  framing: z.string(),
  cameraMotion: z.string(),
  action: z.string(),
  emotionalArc: z.string(),
  audioSegmentIds: z.array(z.string()),
  continuity: z.enum(CONTINUITY_KINDS),
  dependsOn: z.string().nullable(),
  speechMode: z.enum(SPEECH_MODES),
  intendedBeginning: z.string(),
  intendedEnding: z.string(),
  boundaryIn: BoundaryStateSchema,
  boundaryOut: BoundaryStateSchema,
});
export type Shot = z.infer<typeof ShotSchema>;

export const AudioSegmentSchema = z.object({
  id: z.string().min(1),
  track: z.enum(AUDIO_TRACKS),
  shotIds: z.array(z.string()).min(1),
  startOffsetSec: z.number().min(0),
  durationSec: z.number().positive(),
  text: z.string().nullable(),
  voiceId: z.string().nullable(),
  nativeAudioPolicy: z.enum(NATIVE_AUDIO_POLICIES),
  fadeInSec: z.number().min(0),
  fadeOutSec: z.number().min(0),
  prompt: z.string().nullable(),
  measuredDurationSec: z.number().positive().nullable(),
});
export type AudioSegment = z.infer<typeof AudioSegmentSchema>;

export const VoiceRecordSchema = z.object({
  id: z.string().min(1),
  characterId: z.string().nullable(),
  identity: VoiceIdentitySchema,
  previewOnly: z.boolean(),
});
export type VoiceRecord = z.infer<typeof VoiceRecordSchema>;

export const ObservationSchema = z.object({
  shotId: z.string(),
  assetId: z.string(),
  outgoingEditSec: z.number().min(0),
  completedActions: z.array(z.string()),
  incompleteActions: z.array(z.string()),
  deviations: z.array(z.string()),
  boundaryOut: BoundaryStateSchema,
  /** Image asset holding the exact final frame of the reviewed clip. */
  lastFrameAssetId: z.string().nullable().default(null),
  /** Literal, exhaustive description of that frame, written from the pixels rather than the plan. */
  lastFrameDescription: z.string().default(""),
});
export type Observation = z.infer<typeof ObservationSchema>;

export const ReviewFindingSchema = z.object({
  id: z.string().min(1),
  shotId: z.string().nullable(),
  timestampSec: z.number().min(0).nullable(),
  severity: z.enum(["info", "warn", "error"]),
  category: z.string(),
  summary: z.string(),
  evidence: z.string(),
  proposedRepair: z.string(),
  advisoryScore: z.number().min(0).max(1).nullable(),
});
export type ReviewFinding = z.infer<typeof ReviewFindingSchema>;

export const ReviewRecordSchema = z.object({
  targetKind: z.enum(["shot", "join", "sequence"]),
  targetId: z.string(),
  findings: z.array(ReviewFindingSchema),
  passed: z.boolean(),
});
export type ReviewRecord = z.infer<typeof ReviewRecordSchema>;

export const TimelineClipSchema = z.object({
  id: z.string().min(1),
  shotId: z.string().nullable(),
  assetId: z.string(),
  kind: z.enum(["video", "audio", "image"]),
  startSec: z.number().min(0),
  durationSec: z.number().positive(),
  trimInSec: z.number().min(0),
  trimOutSec: z.number().min(0),
  volume: z.number().min(0).max(2),
  fadeInSec: z.number().min(0),
  fadeOutSec: z.number().min(0),
  transition: z.enum(["cut", "dissolve", "none"]).nullable(),
});
export type TimelineClip = z.infer<typeof TimelineClipSchema>;

export const ProductionTimelineSchema = z.object({
  fps: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  clips: z.array(TimelineClipSchema),
  durationSec: z.number().min(0),
});
export type ProductionTimeline = z.infer<typeof ProductionTimelineSchema>;

export const QuestionsRecordSchema = z.object({
  questions: z.array(QuestionSchema),
});
export type QuestionsRecord = z.infer<typeof QuestionsRecordSchema>;

export const AssumptionsRecordSchema = z.object({
  assumptions: z.array(AssumptionSchema),
  proposedAdditions: z.array(ProposedAdditionSchema),
});
export type AssumptionsRecord = z.infer<typeof AssumptionsRecordSchema>;
