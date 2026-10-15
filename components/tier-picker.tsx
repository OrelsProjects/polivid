"use client";

import type { KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import {
  describeModeTier,
  TIER_LABELS,
  VIDEO_TIERS,
  type VideoMode,
  type VideoTier,
} from "@/lib/video/modes";

export function TierPicker({
  mode,
  value,
  onChange,
  disabled,
}: {
  mode: VideoMode;
  value: VideoTier;
  onChange: (tier: VideoTier) => void;
  disabled?: boolean;
}) {
  const tiers = mode.tiers;
  if (!tiers) return null;

  const handleGroupKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = VIDEO_TIERS.indexOf(value);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(VIDEO_TIERS[(index + 1) % VIDEO_TIERS.length]);
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(VIDEO_TIERS[(index - 1 + VIDEO_TIERS.length) % VIDEO_TIERS.length]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span id="tier-picker-label" className="text-sm font-medium">
        Quality
      </span>
      <div
        role="radiogroup"
        aria-labelledby="tier-picker-label"
        onKeyDown={handleGroupKeyDown}
        className="grid gap-2 sm:grid-cols-3"
      >
        {VIDEO_TIERS.map((tier) => {
          const active = tier === value;
          const details = describeModeTier(tiers[tier]);
          return (
            <button
              key={tier}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${TIER_LABELS[tier]}. ${details.name}, ${details.price}, up to ${details.maxLength} seconds.`}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => {
                onChange(tier);
              }}
              className={cn(
                "flex min-h-11 cursor-pointer flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                active
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
              )}
            >
              <span className="text-sm font-semibold text-foreground">{TIER_LABELS[tier]}</span>
              <span className="text-xs text-foreground">{details.name}</span>
              <span className="text-xs text-muted-foreground">
                {details.price} · up to {details.maxLength}s
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
