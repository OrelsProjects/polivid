import type { ProductionStage, ProductionStatus, StepKind, StepStatus } from "./schema";

export const PLANNING_STEPS = [
  { key: "save", label: "Saving the request" },
  { key: "read", label: "Reading the idea" },
  { key: "develop", label: "Writing the script" },
  { key: "check", label: "Checking the story" },
  { key: "structure", label: "Planning shots and sound" },
  { key: "cost", label: "Checking cost and capabilities" },
  { key: "ready", label: "Opening the plan" },
] as const;

export type PlanningStepKey = (typeof PLANNING_STEPS)[number]["key"];

export type PlanningProgress = {
  key: PlanningStepKey;
  label: string;
  state: "active" | "done";
};

export type StatusItemState = "pending" | "active" | "done" | "failed";

export type StatusItem = {
  key: string;
  label: string;
  state: StatusItemState;
  detail?: string;
};

export const STATUS_LABEL: Record<ProductionStatus, string> = {
  drafting: "Planning",
  awaiting_answers: "Needs a few choices",
  preview: "Ready to review",
  generating: "Generating",
  reviewing: "Reviewing footage",
  assembling: "Assembling",
  ready: "Ready",
  failed: "Failed",
  canceled: "Canceled",
};

export const STAGE_LABEL: Record<ProductionStage, string> = {
  intake: "Saving the request",
  develop: "Writing the script",
  structure: "Planning shots and sound",
  preview: "Ready to review",
  references: "Making stills",
  speech: "Recording speech",
  shots: "Filming shots",
  review: "Reviewing footage",
  music: "Scoring music and sound",
  assemble: "Assembling the timeline",
  done: "Done",
};

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  develop: "Writing the script",
  structure: "Planning shots",
  preflight: "Checking cost and capabilities",
  reference_image: "Making a still",
  speech: "Recording speech",
  shot_video: "Filming a shot",
  lipsync: "Syncing lips",
  review_shot: "Reviewing a shot",
  music: "Scoring music",
  ambience: "Adding ambience",
  sfx: "Adding sound effects",
  assemble: "Assembling the timeline",
  final_review: "Final review",
  export: "Finishing up",
};

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  pending: "Queued",
  ready: "Next",
  leased: "Running",
  waiting_provider: "Waiting on the model",
  succeeded: "Done",
  failed: "Failed",
  canceled: "Canceled",
  blocked: "Waiting",
};

export const isPlanningStepKey = (value: string): value is PlanningStepKey =>
  PLANNING_STEPS.some((step) => step.key === value);

export const labelForPlanningStep = (key: PlanningStepKey, fallback?: string) =>
  fallback ?? PLANNING_STEPS.find((step) => step.key === key)?.label ?? key;

export const planningItemsFromKey = (
  currentKey: PlanningStepKey | null,
  currentState: StatusItemState = "active",
): StatusItem[] => {
  const index = PLANNING_STEPS.findIndex((step) => step.key === currentKey);
  return PLANNING_STEPS.map((step, stepIndex) => ({
    key: step.key,
    label: step.label,
    state:
      index < 0
        ? "pending"
        : stepIndex < index
          ? "done"
          : stepIndex === index
            ? currentState
            : "pending",
  }));
};

export const applyPlanningProgress = (
  items: StatusItem[],
  event: PlanningProgress,
): StatusItem[] => {
  const index = PLANNING_STEPS.findIndex((step) => step.key === event.key);
  if (index < 0) return items;
  return PLANNING_STEPS.map((step, stepIndex) => {
    const previous = items.find((item) => item.key === step.key);
    const isCurrent = step.key === event.key;
    return {
      key: step.key,
      label: isCurrent ? event.label : (previous?.label ?? step.label),
      state:
        stepIndex < index
          ? "done"
          : isCurrent
            ? event.state === "done"
              ? "done"
              : "active"
            : (previous?.state === "done" ? "done" : "pending"),
    };
  });
};

export const stageForStepKind = (kind: string): ProductionStage => {
  if (kind === "reference_image") return "references";
  if (kind === "speech") return "speech";
  if (kind === "shot_video" || kind === "lipsync") return "shots";
  if (kind === "review_shot" || kind === "final_review") return "review";
  if (kind === "music" || kind === "ambience" || kind === "sfx") return "music";
  if (kind === "assemble" || kind === "export") return "assemble";
  return "shots";
};

export const statusForStepKind = (kind: string): ProductionStatus => {
  if (kind === "review_shot" || kind === "final_review") return "reviewing";
  if (kind === "assemble" || kind === "export") return "assembling";
  return "generating";
};

export const prettyTarget = (targetKey: string) => {
  const name = targetKey.includes(":") ? targetKey.slice(targetKey.indexOf(":") + 1) : targetKey;
  return name.replace(/[_-]+/g, " ");
};

export const activityLabel = (args: {
  status: ProductionStatus;
  stage: ProductionStage;
  steps?: { kind: StepKind; status: StepStatus; targetKey: string }[];
}) => {
  if (args.status === "failed") return args.stage ? STAGE_LABEL[args.stage] : STATUS_LABEL.failed;
  if (args.status === "awaiting_answers") return STATUS_LABEL.awaiting_answers;
  const running = args.steps?.find((step) => step.status === "leased" || step.status === "waiting_provider");
  if (running) {
    const label = STEP_KIND_LABEL[running.kind] ?? running.kind;
    const target = prettyTarget(running.targetKey);
    return target ? `${label} · ${target}` : label;
  }
  return STAGE_LABEL[args.stage] ?? STATUS_LABEL[args.status];
};

export const generationItems = (
  steps: { kind: StepKind; status: StepStatus }[],
): StatusItem[] => {
  const order: StepKind[] = [
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
  ];
  return order
    .filter((kind) => steps.some((step) => step.kind === kind))
    .map((kind) => {
      const group = steps.filter((step) => step.kind === kind);
      const done = group.filter((step) => step.status === "succeeded").length;
      const failed = group.some((step) => step.status === "failed");
      const active = group.some((step) => step.status === "leased" || step.status === "waiting_provider");
      return {
        key: kind,
        label: STEP_KIND_LABEL[kind],
        detail: group.length > 1 ? `${done}/${group.length}` : undefined,
        state: (failed ? "failed" : done === group.length ? "done" : active ? "active" : "pending") as StatusItemState,
      };
    });
};

export const planningItemsFromStage = (stage: ProductionStage, status: ProductionStatus): StatusItem[] => {
  const currentKey: PlanningStepKey =
    status === "awaiting_answers" || status === "preview" || status === "failed"
      ? "ready"
      : stage === "intake"
        ? "save"
        : stage === "structure"
          ? "structure"
          : stage === "preview"
            ? "ready"
            : "develop";
  const currentState: StatusItemState =
    status === "failed" ? "failed" : status === "preview" || status === "awaiting_answers" ? "done" : "active";
  const items = planningItemsFromKey(currentKey, currentState);
  if (status === "awaiting_answers") {
    return items.map((item) => (item.key === "ready" ? { ...item, label: "Waiting on a few choices", state: "active" } : item));
  }
  return items;
};

export const formatElapsed = (startedAt: number, now: number) => {
  const total = Math.max(0, Math.floor((now - startedAt) / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
