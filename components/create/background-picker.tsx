"use client";

import { MediaUpload } from "@/components/media-upload";
import { cn } from "@/lib/utils";
import { BACKGROUND_LOOPS } from "@/lib/video/backgrounds";

/**
 * Picks the clip that plays behind narrated text: one of the built-in loops, or a short
 * clip the person uploads. An uploaded clip wins while it is set.
 */
export function BackgroundPicker({
  backgroundId,
  backgroundKey,
  onPick,
  onUpload,
  disabled,
}: {
  backgroundId: string;
  backgroundKey: string | null;
  onPick: (id: string) => void;
  onUpload: (key: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Background</legend>
      <div role="radiogroup" aria-label="Built-in backgrounds" className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {BACKGROUND_LOOPS.map((loop) => {
          const active = !backgroundKey && backgroundId === loop.id;
          return (
            <button
              key={loop.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => {
                onUpload(null);
                onPick(loop.id);
              }}
              className={cn(
                "flex cursor-pointer flex-col gap-1.5 rounded-xl border p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/30",
              )}
            >
              {/* A poster frame of the loop. Decorative: the name below says which one it is. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={loop.poster}
                alt=""
                width={270}
                height={480}
                loading="lazy"
                className="aspect-[9/16] max-h-40 w-full rounded-lg object-cover"
              />
              <span className="px-1 pb-0.5 text-xs font-medium">{loop.name}</span>
            </button>
          );
        })}
      </div>
      <MediaUpload
        kind="video"
        mediaKey={backgroundKey}
        onChange={onUpload}
        disabled={disabled}
        label="Or your own clip"
        hint="Optional. MP4 or WebM under 20 MB. It plays without sound and repeats until the voice ends."
      />
    </fieldset>
  );
}
