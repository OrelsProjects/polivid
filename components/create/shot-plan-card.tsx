"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { RevealPanel } from "@/components/motion/motion";
import { MAX_CUT_CAMERA, retimeCut } from "@/lib/music/song-plan";
import type { ShotPlan } from "@/lib/store/endpoints/videos";
import { cn } from "@/lib/utils";

const clock = (total: number) => {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/** Plain-language summary of a lyrics shot plan, plus whether every shot is trimmed the same way. */
const describeShotPlan = (plan: ShotPlan, length: number) => {
  const count = plan.cuts.length;
  const shots = count === 1 ? "1 shot" : `${count} shots`;
  const credits = `${plan.credits.toLocaleString()} credits`;
  const show = plan.cuts[0]?.seconds;
  const film = plan.cuts[0]?.filmSec;
  const uniform =
    count > 0 && plan.cuts.every((cut) => cut.seconds === show && cut.filmSec === film);
  if (uniform && show && film && film > show) {
    const shown = show === 1 ? "1 second" : `${show} seconds`;
    const filmed = film === 1 ? "1 second" : `${film} seconds`;
    return {
      lines: [
        `${shots} in this ${length}-second video. Each shot stays on screen for ${shown}.`,
        `The model films each shot for ${filmed}, then the extra is trimmed off.`,
        `${count} × ${film} seconds is ${plan.filmedSeconds} seconds of filming. ${credits}.`,
      ],
      uniformTrim: true,
    };
  }
  if (plan.filmedSeconds > length) {
    return {
      lines: [
        `${shots} in this ${length}-second video.`,
        "Shots shorter than the model can film are generated longer and trimmed.",
        `That is ${plan.filmedSeconds} seconds of filming. ${credits}.`,
      ],
      uniformTrim: false,
    };
  }
  return {
    lines: [`${shots} in this ${length}-second video. ${credits}.`],
    uniformTrim: false,
  };
};

const fieldClass =
  "w-full rounded-lg border border-transparent bg-transparent text-sm outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/** One shot row. Framing updates as you type. Length commits when the field closes. */
const ShotRow = ({
  camera,
  seconds,
  at,
  filmNote,
  disabled,
  durationLocked,
  onCamera,
  onSeconds,
}: {
  camera: string;
  seconds: number;
  at: string;
  filmNote: string | null;
  disabled?: boolean;
  durationLocked: boolean;
  onCamera: (camera: string) => void;
  onSeconds: (seconds: number) => void;
}) => {
  const [secondsDraft, setSecondsDraft] = useState<string | null>(null);
  const secondsValue = secondsDraft ?? String(seconds);
  const commitSeconds = () => {
    const draft = secondsDraft;
    setSecondsDraft(null);
    if (draft === null || !/^\d+$/.test(draft)) return;
    const parsed = Number(draft);
    if (parsed >= 1 && parsed !== seconds) onSeconds(parsed);
  };
  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-2">
      <span className="pt-2.5 tabular-nums text-sm text-muted-foreground">{at}</span>
      <label className="min-w-0">
        <span className="sr-only">Shot at {at}</span>
        <textarea
          value={camera}
          rows={1}
          maxLength={MAX_CUT_CAMERA}
          disabled={disabled}
          placeholder="What the camera shows"
          onChange={(event) => onCamera(event.target.value.slice(0, MAX_CUT_CAMERA))}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            event.currentTarget.blur();
          }}
          className={cn(fieldClass, "field-sizing-content min-h-11 resize-none px-2 py-2.5 leading-5")}
        />
      </label>
      <div className="flex flex-col items-end gap-0.5">
        <label
          className={cn(
            "flex h-11 items-center rounded-lg border border-transparent pr-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            !durationLocked && "hover:border-border",
          )}
        >
          <span className="sr-only">Seconds on screen at {at}</span>
          <input
            value={secondsValue}
            inputMode="numeric"
            disabled={disabled}
            readOnly={durationLocked}
            size={2}
            onFocus={() => {
              if (!durationLocked) setSecondsDraft(String(seconds));
            }}
            onChange={(event) => setSecondsDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
            onBlur={commitSeconds}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              event.currentTarget.blur();
            }}
            className="w-8 bg-transparent text-right text-sm tabular-nums outline-none read-only:text-muted-foreground disabled:opacity-50"
          />
          <span className="text-sm text-muted-foreground" aria-hidden>
            s
          </span>
        </label>
        {filmNote ? <span className="pr-1.5 text-xs text-muted-foreground">{filmNote}</span> : null}
      </div>
    </li>
  );
};

export const ShotPlanCard = ({
  plan,
  length,
  maxSeconds,
  disabled,
  onChange,
}: {
  plan: ShotPlan;
  length: number;
  maxSeconds: number;
  disabled?: boolean;
  onChange: (cuts: { seconds: number; camera: string; images?: number[] }[]) => void;
}) => {
  const summary = describeShotPlan(plan, length);
  const brief = plan.brief;
  const roles = plan.attachmentRoles ?? [];
  const showRead = Boolean(
    (brief && (brief.subject || brief.setting || brief.director || brief.style || brief.mustKeep || brief.mustAvoid)) ||
      roles.length > 0,
  );
  const listId = useId();
  const [open, setOpen] = useState(true);
  const rows = plan.cuts.map((cut, index) => ({
    cut,
    index,
    at: plan.cuts.slice(0, index).reduce((sum, item) => sum + item.seconds, 0),
  }));
  const shotLabel = plan.cuts.length === 1 ? "1 shot" : `${plan.cuts.length} shots`;
  const durationLocked = (index: number) => {
    const cut = plan.cuts[index];
    if (!cut) return true;
    const others = plan.cuts.filter((_, cursor) => cursor !== index);
    const canGrow = cut.seconds < maxSeconds && others.some((other) => other.seconds > 1);
    const canShrink = cut.seconds > 1 && others.some((other) => other.seconds < maxSeconds);
    return !canGrow && !canShrink;
  };
  const lengthsLocked = rows.every(({ index }) => durationLocked(index));
  const replace = (index: number, camera: string) => {
    onChange(
      plan.cuts.map((cut, cursor) =>
        cursor === index
          ? { seconds: cut.seconds, camera, images: cut.images }
          : { seconds: cut.seconds, camera: cut.camera, images: cut.images },
      ),
    );
  };
  const retime = (index: number, seconds: number) => {
    onChange(retimeCut(plan.cuts, index, seconds, length, maxSeconds));
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Shot plan</h2>
      <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
        {summary.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {showRead ? (
        <div className="mt-3 rounded-xl bg-muted/60 px-3 py-3">
          <h3 className="text-sm font-medium text-foreground">How we read your prompt</h3>
          <dl className="mt-2 flex flex-col gap-1.5 text-sm">
            {brief?.subject ? (
              <div>
                <dt className="text-xs text-muted-foreground">Subject</dt>
                <dd>{brief.subject}</dd>
              </div>
            ) : null}
            {brief?.setting ? (
              <div>
                <dt className="text-xs text-muted-foreground">Place</dt>
                <dd>{brief.setting}</dd>
              </div>
            ) : null}
            {brief?.director || brief?.style ? (
              <div>
                <dt className="text-xs text-muted-foreground">Look and camera</dt>
                <dd>{[brief?.director, brief?.style].filter(Boolean).join(" ")}</dd>
              </div>
            ) : null}
            {brief?.mustKeep ? (
              <div>
                <dt className="text-xs text-muted-foreground">Must stay the same</dt>
                <dd>{brief.mustKeep}</dd>
              </div>
            ) : null}
            {brief?.mustAvoid ? (
              <div>
                <dt className="text-xs text-muted-foreground">Leave out</dt>
                <dd>{brief.mustAvoid}</dd>
              </div>
            ) : null}
          </dl>
          {roles.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <li
                  key={role.index}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                >
                  Image {role.index} · {role.role}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm font-medium"
      >
        <span>{open ? "Hide shots" : `Show ${shotLabel}`}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <RevealPanel open={open} id={listId} className="mt-2">
        <ol className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto px-0.5 py-0.5">
          {rows.map(({ cut, index, at }) => (
            <ShotRow
              key={index}
              camera={cut.camera}
              seconds={cut.seconds}
              at={clock(at)}
              filmNote={cut.filmSec > cut.seconds && !summary.uniformTrim ? `filmed ${cut.filmSec}s` : null}
              disabled={disabled}
              durationLocked={durationLocked(index)}
              onCamera={(camera) => replace(index, camera)}
              onSeconds={(seconds) => retime(index, seconds)}
            />
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          {lengthsLocked
            ? plan.cuts.every((cut) => cut.seconds === 1)
              ? "Every second is already its own shot, so the lengths stay put. Rewrite what each shot shows."
              : "Rewrite what each shot shows. These lengths already fill the video."
            : "Rewrite a shot, or change how many seconds it stays up. A longer shot borrows time from the ones after it."}
        </p>
      </RevealPanel>
    </section>
  );
};
