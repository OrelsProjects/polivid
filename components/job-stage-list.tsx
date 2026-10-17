"use client";

import { Check } from "lucide-react";
import { Fragment } from "react";
import { AudioPlayer } from "@/components/audio-player";
import { cn } from "@/lib/utils";
import type { JobStep } from "@/lib/video/job-status";
import {
  clipProgressLabel,
  stageState,
  stagesForJob,
  stepLabel,
  visibleStages,
} from "@/lib/video/job-stages";

const StageMark = ({ state }: { state: "done" | "current" | "upcoming" }) => {
  if (state === "done") {
    return (
      <span
        className="grid size-4 shrink-0 place-items-center text-primary"
        aria-hidden
      >
        <Check className="size-3.5" />
      </span>
    );
  }
  return (
    <span className="grid size-4 shrink-0 place-items-center" aria-hidden>
      <span
        className={cn(
          "size-2 rounded-full",
          state === "current"
            ? "bg-primary"
            : "border border-current bg-transparent",
        )}
      />
    </span>
  );
};

const StageItem = ({
  step,
  state,
  clipLabel,
  mode,
}: {
  step: JobStep;
  state: "done" | "current" | "upcoming";
  clipLabel: string;
  mode: string;
}) => {
  const label = stepLabel(step, mode);
  const stateName =
    state === "current"
      ? "current stage"
      : state === "done"
        ? "done"
        : "expected";
  const spoken = [label, clipLabel, stateName]
    .filter((part) => part)
    .join(", ");

  return (
    <li
      aria-current={state === "current" ? "step" : undefined}
      aria-label={spoken}
      className={cn(
        "flex items-center gap-2",
        state === "current"
          ? "text-sm font-medium text-foreground"
          : "text-xs text-muted-foreground",
      )}
    >
      <StageMark state={state} />
      <span className="min-w-0 flex-1">
        <span className="block">{label}</span>
        {clipLabel ? (
          <span className="block text-xs font-normal text-muted-foreground">
            {clipLabel}
          </span>
        ) : null}
      </span>
    </li>
  );
};

const SongPlayer = ({ src }: { src: string }) => (
  <li className="pl-6">
    <AudioPlayer src={src} title="The song" />
  </li>
);

export const JobStageList = ({
  mode,
  tier,
  model,
  length,
  currentStep,
  clipIndex,
  clipTotal,
  clipsDone = 0,
  songUrl = null,
}: {
  mode: string;
  tier: string;
  model: string;
  length: number;
  currentStep: JobStep | null;
  clipIndex: number | null;
  clipTotal: number;
  clipsDone?: number;
  songUrl?: string | null;
}) => {
  const parallel = mode === "lyrics";
  const videosLabel = (current: boolean) =>
    clipProgressLabel(
      current ? clipIndex : null,
      clipTotal,
      parallel ? { done: current ? clipsDone : undefined } : undefined,
    );
  const stages = visibleStages(
    stagesForJob({ mode, tier, model, length }),
    currentStep,
  );
  const items = stages.map((step) => ({
    step,
    state: stageState(step, stages, currentStep),
  }));
  const earlier = items.filter((item) => item.state !== "upcoming");
  const upcoming = items.filter((item) => item.state === "upcoming");

  return (
    <div className="flex w-full flex-col gap-3 text-left">
      {earlier.length > 0 ? (
        <ol
          className="flex flex-col gap-1.5"
          aria-label="Completed and current stages"
        >
          {earlier.map((item) => (
            <Fragment key={item.step}>
              <StageItem
                step={item.step}
                state={item.state}
                mode={mode}
                clipLabel={
                  item.step === "videos"
                    ? videosLabel(item.state === "current")
                    : ""
                }
              />
              {item.step === "script" && item.state === "done" && songUrl ? (
                <SongPlayer src={songUrl} />
              ) : null}
            </Fragment>
          ))}
        </ol>
      ) : null}
      {upcoming.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">Expected</p>
          <ol className="flex flex-col gap-1.5" aria-label="Expected stages">
            {upcoming.map((item) => (
              <StageItem
                key={item.step}
                step={item.step}
                state={item.state}
                mode={mode}
                clipLabel={item.step === "videos" ? videosLabel(false) : ""}
              />
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
};
