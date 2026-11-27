"use client";

import { MessageSquare, Volume2, VolumeX } from "lucide-react";
import type { SkitPlan } from "@/lib/store/endpoints/videos";
import { cn } from "@/lib/utils";

/** The line in quotes, unless the writer already put it in quotes. */
const quoted = (say: string) => (/^["“'‘]/.test(say.trim()) ? say.trim() : `“${say.trim()}”`);

const fieldClass =
  "w-full rounded-lg border border-transparent bg-transparent text-sm outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/**
 * A skit's plan, before anything is filmed: for each beat, the line read over it, the shot the video
 * model films, how long it runs, and the one sound it keeps. Shots and sounds can be edited here.
 */
export function SkitPlanCard({
  plan,
  disabled,
  onChange,
  onReplan,
  onDiscuss,
}: {
  plan: SkitPlan;
  disabled?: boolean;
  onChange: (shots: SkitPlan["shots"]) => void;
  onReplan: () => void;
  /** Opens a new Coach chat with this plan in the message box. */
  onDiscuss?: () => void;
}) {
  const update = (index: number, patch: Partial<SkitPlan["shots"][number]>) =>
    onChange(plan.shots.map((shot, at) => (at === index ? { ...shot, ...patch } : shot)));
  const sounds = plan.shots.filter((shot) => shot.sound.trim()).length;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="The skit's plan">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">The plan</h2>
        <p className="text-xs text-muted-foreground">
          {plan.shots.length} {plan.shots.length === 1 ? "shot" : "shots"} · about {plan.seconds} seconds, set by the voice ·{" "}
          {sounds === 0 ? "silent under the voice" : `${sounds} ${sounds === 1 ? "sound" : "sounds"}`} · {plan.credits.toLocaleString()} credits
        </p>
      </div>
      <ol className="mt-3 flex flex-col gap-3">
        {plan.shots.map((shot, index) => (
          <li key={index} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Shot {index + 1}</span>
              <span className="tabular-nums">
                ~{shot.seconds}s{shot.hold > 0 ? ` · holds ${shot.hold}s after the line` : ""}
              </span>
            </div>
            <p className="mt-1 text-sm">{quoted(shot.say)}</p>
            <label className="mt-2 block">
              <span className="sr-only">What shot {index + 1} films</span>
              <textarea
                value={shot.shot}
                disabled={disabled}
                rows={3}
                maxLength={1200}
                onChange={(event) => update(index, { shot: event.target.value })}
                className={cn(fieldClass, "field-sizing-content resize-none px-2 py-1 text-emerald-700 dark:text-emerald-400")}
              />
            </label>
            <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              {shot.sound.trim() ? <Volume2 className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden /> : <VolumeX className="size-3.5 shrink-0" aria-hidden />}
              <span className="sr-only">Sound for shot {index + 1}</span>
              <input
                value={shot.sound}
                disabled={disabled}
                maxLength={120}
                placeholder="No sound: silent under the voice"
                onChange={(event) => update(index, { sound: event.target.value })}
                className={cn(fieldClass, "h-7 px-2 text-xs text-sky-700 placeholder:text-muted-foreground dark:text-sky-400")}
              />
            </label>
          </li>
        ))}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled={disabled}
          onClick={onReplan}
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          Plan it again
        </button>
        {onDiscuss ? (
          <button
            type="button"
            disabled={disabled}
            onClick={onDiscuss}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
          >
            <MessageSquare className="size-3.5" aria-hidden />
            Discuss in chat
          </button>
        ) : null}
      </div>
    </section>
  );
}
