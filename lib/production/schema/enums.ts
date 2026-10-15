export const PRODUCTION_STATUSES = [
  "drafting",
  "awaiting_answers",
  "preview",
  "generating",
  "reviewing",
  "assembling",
  "ready",
  "failed",
  "canceled",
] as const;
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

/** Statuses during which the production is actively being worked on by the pipeline. */
export const LIVE_PRODUCTION_STATUSES: readonly ProductionStatus[] = ["drafting", "generating", "reviewing", "assembling"];
export const isLiveProductionStatus = (status: ProductionStatus) => LIVE_PRODUCTION_STATUSES.includes(status);

export const PRODUCTION_STAGES = [
  "intake",
  "develop",
  "structure",
  "preview",
  "references",
  "speech",
  "shots",
  "review",
  "music",
  "assemble",
  "done",
] as const;
export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const PRODUCTION_MODES = ["review", "auto"] as const;
export type ProductionMode = (typeof PRODUCTION_MODES)[number];

export const PLANNER_PROVIDERS = ["claude", "openai"] as const;
export type PlannerProvider = (typeof PLANNER_PROVIDERS)[number];

export const PLANNER_TASKS = ["extract", "develop", "structure", "escalate", "frontier"] as const;
export type PlannerTask = (typeof PLANNER_TASKS)[number];

export const ENTITY_KINDS = [
  "input",
  "requirements",
  "assumptions",
  "brief",
  "script",
  "character",
  "location",
  "prop",
  "reference",
  "scene",
  "shot",
  "audio_segment",
  "voice",
  "observation",
  "review",
  "timeline",
  "questions",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const VERSION_ORIGINS = ["user", "planner", "observed", "system"] as const;
export type VersionOrigin = (typeof VERSION_ORIGINS)[number];

export const VERSION_STATUSES = ["draft", "accepted", "superseded", "stale"] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

/** `derived` marks helper files (such as a clip's final frame) that never appear in the timeline or editor. */
export const ASSET_STATUSES = ["candidate", "accepted", "rejected", "alternate", "derived"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const STEP_KINDS = [
  "develop",
  "structure",
  "preflight",
  "reference_image",
  "speech",
  "shot_video",
  "lipsync",
  "review_shot",
  "music",
  "ambience",
  "sfx",
  "assemble",
  "final_review",
  "export",
] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export const STEP_STATUSES = [
  "pending",
  "ready",
  "leased",
  "waiting_provider",
  "succeeded",
  "failed",
  "canceled",
  "blocked",
] as const;
export type StepStatus = (typeof STEP_STATUSES)[number];

export const GENERATION_JOB_STATUSES = [
  "pending",
  "submitting",
  "in_progress",
  "completed",
  "failed",
  "canceled",
  "expired",
  "needs_reconcile",
] as const;
export type GenerationJobStatus = (typeof GENERATION_JOB_STATUSES)[number];

export const PROVENANCE = [
  "explicit",
  "project_preference",
  "inferred",
  "proposed_addition",
  "unresolved",
] as const;
export type Provenance = (typeof PROVENANCE)[number];

export const INPUT_CLASSES = ["rough_idea", "outline", "detailed_script", "production_plan"] as const;
export type InputClass = (typeof INPUT_CLASSES)[number];

export const REFERENCE_ROLES = ["first_frame", "last_frame", "style_ref", "subject_ref"] as const;
export type ReferenceRole = (typeof REFERENCE_ROLES)[number];

export const CONTINUITY_KINDS = ["continue_shot", "new_angle", "new_scene"] as const;
export type ContinuityKind = (typeof CONTINUITY_KINDS)[number];

export const SPEECH_MODES = ["offscreen", "native", "lipsync"] as const;
export type SpeechMode = (typeof SPEECH_MODES)[number];

export const AUDIO_TRACKS = ["dialogue", "narration", "music", "ambience", "sfx"] as const;
export type AudioTrack = (typeof AUDIO_TRACKS)[number];

export const NATIVE_AUDIO_POLICIES = ["retain", "replace", "mix"] as const;
export type NativeAudioPolicy = (typeof NATIVE_AUDIO_POLICIES)[number];

export const ADAPTER_ROUTES = ["openrouter", "google", "openai", "elevenlabs", "sync", "ffmpeg", "mock"] as const;
export type AdapterRoute = (typeof ADAPTER_ROUTES)[number];

export const EXTENSION_BEHAVIORS = ["none", "returns_full", "returns_new_only"] as const;
export type ExtensionBehavior = (typeof EXTENSION_BEHAVIORS)[number];
