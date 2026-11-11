"use client";

import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { CoachToolPicker } from "@/components/coach/coach-tool-picker";
import { ModelPicker } from "@/components/model-picker";
import { Button } from "@/components/ui/button";
import type { BriefEdits } from "@/lib/coach/brief-edit-notes";
import { briefClipChoices, briefCredits, briefModelChoices, briefModelId, type CoachBrief } from "@/lib/coach/brief-blocks";
import { GENERATION_MODEL_IDS, generationModelById, type GenerationModelId } from "@/lib/video/models";
import { TIER_LABELS, VIDEO_TIERS } from "@/lib/video/modes";
import { listPresetsFor, presetById } from "@/lib/video/presets";

export type BriefApproval = "ready" | "sent";

const FORMATS = ["9:16", "16:9", "1:1", "4:3", "3:4"];
const LENGTHS = [5, 8, 10, 15, 20, 30, 45, 60];

interface Setting {
  key: Exclude<keyof BriefEdits, "clips">;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  current: string;
}

const withCurrent = (options: { value: string; label: string }[], value: string, label: string) =>
  options.some((option) => option.value === value) || !value ? options : [{ value, label }, ...options];

const settingsFor = (brief: CoachBrief): Setting[] => [
  {
    key: "format",
    label: "Format",
    value: brief.format,
    current: brief.format,
    options: withCurrent(FORMATS.map((value) => ({ value, label: value })), brief.format, brief.format),
  },
  {
    key: "length",
    label: "Length",
    value: `${brief.length}s`,
    current: brief.length,
    options: withCurrent(
      LENGTHS.map((value) => ({ value: String(value), label: `${value}s` })),
      brief.length,
      `${brief.length}s`,
    ),
  },
  {
    key: "preset",
    label: "Style",
    value: presetById(brief.preset)?.name ?? brief.preset,
    current: brief.preset,
    options: withCurrent(
      listPresetsFor("both").map((entry) => ({ value: entry.id, label: entry.name })),
      brief.preset,
      brief.preset,
    ),
  },
  {
    key: "tier",
    label: "Tier",
    value: TIER_LABELS[brief.tier as keyof typeof TIER_LABELS] ?? brief.tier,
    current: brief.tier,
    options: withCurrent(
      VIDEO_TIERS.map((value) => ({ value, label: TIER_LABELS[value] })),
      brief.tier,
      brief.tier,
    ),
  },
];

export function CoachBriefCard({
  brief: proposed,
  models = GENERATION_MODEL_IDS,
  approvedModelId,
  approval,
  onApprove,
}: {
  brief: CoachBrief;
  /** Models this server can film with. Others stay hidden. */
  models?: readonly GenerationModelId[];
  /** Model named on the approval that followed this brief. */
  approvedModelId?: GenerationModelId;
  approval?: BriefApproval;
  onApprove?: (modelId?: GenerationModelId, edits?: BriefEdits) => void;
}) {
  const [edits, setEdits] = useState<BriefEdits>({});
  const brief: CoachBrief = { ...proposed, ...edits };
  const editable = approval === "ready";
  const choices = briefModelChoices(brief, models);
  const initial = briefModelId(brief, models);
  const [picked, setPicked] = useState<GenerationModelId | null>(null);
  const pickedId = picked && generationModelById(picked) ? picked : null;
  const selected =
    approval === "ready"
      ? picked && choices.includes(picked)
        ? picked
        : initial
      : approvedModelId && generationModelById(approvedModelId)
        ? approvedModelId
        : (pickedId ?? initial);
  const showPicker = approval === "ready" && choices.length > 1 && Boolean(selected);
  const modelName = selected ? (generationModelById(selected)?.name ?? selected) : "";
  const settings = settingsFor(brief);
  const [pickedClips, setPickedClips] = useState<number | null>(null);
  const clipChoices = briefClipChoices(brief, selected ?? null);
  const clips = clipChoices
    ? Math.min(clipChoices.most, Math.max(clipChoices.least, pickedClips ?? clipChoices.suggested))
    : null;
  const setSetting = (key: Exclude<keyof BriefEdits, "clips">, value: string) =>
    setEdits((previous) => {
      const next = { ...previous };
      if (value === proposed[key]) delete next[key];
      else next[key] = value;
      return next;
    });
  const credits = briefCredits(selected ? { ...brief, model: selected } : brief, clips ?? undefined);

  return (
    <article className="relative mt-3 rounded-2xl border border-border bg-muted/40 text-sm" aria-label="Proposed brief">
      <div className="p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Proposed brief</p>
        <div className="relative z-30 mt-3">
          <CoachToolPicker value={brief.mode} onChange={(id) => setSetting("mode", id)} editable={editable} />
        </div>
        <dl className="mt-3 flex flex-wrap gap-2">
          {settings.map((setting) => (
            <div
              key={setting.label}
              className="relative rounded-xl border border-border bg-card px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring"
            >
              <dt className="text-xs text-muted-foreground">{setting.label}</dt>
              <dd className="flex items-center gap-1 font-medium">
                {setting.value}
                {editable ? <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden /> : null}
              </dd>
              {editable ? (
                <select
                  aria-label={`Change ${setting.label.toLowerCase()}`}
                  value={setting.current}
                  onChange={(event) => setSetting(setting.key, event.target.value)}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                >
                  {setting.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          ))}
          {clipChoices && clips ? (
            <div className="relative rounded-xl border border-border bg-card px-3 py-1.5 focus-within:ring-2 focus-within:ring-ring">
              <dt className="text-xs text-muted-foreground">Clips</dt>
              <dd className="flex items-center gap-1 font-medium">
                {clips === 1 ? "1 clip" : `${clips} clips`}
                {editable && clipChoices.most > clipChoices.least ? (
                  <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
                ) : null}
              </dd>
              {editable && clipChoices.most > clipChoices.least ? (
                <select
                  aria-label="Change how many clips are filmed"
                  value={clips}
                  onChange={(event) => setPickedClips(Number(event.target.value))}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                >
                  {Array.from({ length: clipChoices.most - clipChoices.least + 1 }, (_, index) => clipChoices.least + index).map(
                    (count) => (
                      <option key={count} value={count}>
                        {count === 1 ? "1 clip" : `${count} clips`}
                      </option>
                    ),
                  )}
                </select>
              ) : null}
            </div>
          ) : null}
          {!showPicker && modelName ? (
            <div className="rounded-xl border border-border bg-card px-3 py-1.5">
              <dt className="text-xs text-muted-foreground">Model</dt>
              <dd className="font-medium">{modelName}</dd>
            </div>
          ) : null}
        </dl>
        {showPicker && selected ? (
          <div className="relative z-20 mt-4">
            <ModelPicker
              value={selected}
              onChange={setPicked}
              models={[...choices]}
              requireReferenceImages={brief.frames.length > 0}
            />
          </div>
        ) : null}
        {brief.hook && (
          <p className="mt-4 leading-relaxed">
            <span className="font-semibold">Hook. </span>
            {brief.hook}
          </p>
        )}
        {brief.beats.length > 0 && (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed text-foreground/80 marker:text-muted-foreground">
            {brief.beats.map((beat) => (
              <li key={beat}>{beat}</li>
            ))}
          </ol>
        )}
        {brief.vo && <p className="mt-3 leading-relaxed text-foreground/80">{brief.vo}</p>}
        {brief.cta && (
          <p className="mt-3 leading-relaxed">
            <span className="font-semibold">CTA. </span>
            {brief.cta}
          </p>
        )}
      </div>
      {approval ? (
        <div className="flex flex-col gap-2 rounded-b-2xl border-t border-border bg-card px-4 py-3">
          {approval === "sent" ? (
            <p className="flex items-center gap-2 text-sm font-medium" role="status">
              <Check className="size-4 text-primary" aria-hidden />
              Approved. Queuing it now.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  size="lg"
                  className="h-11 w-full rounded-xl sm:w-auto sm:px-6"
                  onClick={() => onApprove?.(selected ?? undefined, clips ? { ...edits, clips: String(clips) } : edits)}
                >
                  Approve
                </Button>
                {credits > 0 ? (
                  <p className="text-xs text-muted-foreground" aria-live="polite">
                    Uses about {credits.toLocaleString()} credits
                  </p>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">Tap the tool or a setting to change it, or keep chatting to edit.</p>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
