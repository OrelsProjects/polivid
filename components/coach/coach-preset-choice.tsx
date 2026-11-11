"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { PresetPicker, type CustomPresetTile } from "@/components/preset-picker";
import { PresetPoster } from "@/components/preset-poster";
import { Button } from "@/components/ui/button";
import { presetById } from "@/lib/video/presets";

const lookFor = (id: string, customPresets: readonly CustomPresetTile[]) => {
  const catalog = presetById(id);
  if (catalog) return { id: catalog.id, name: catalog.name, tagline: catalog.tagline, poster: catalog.poster };
  const custom = customPresets.find((preset) => preset.id === id);
  if (!custom) return null;
  return { id: custom.id, name: custom.name, tagline: custom.tagline, poster: custom.poster };
};

export function CoachPresetChoice({
  recommendedId,
  reason,
  engine = "footage",
  customPresets = [],
  confirmedId = "",
  disabled = false,
  onConfirm,
}: {
  /** Preset id from suggest_preset. */
  recommendedId: string;
  reason?: string;
  engine?: "footage" | "motion";
  customPresets?: readonly CustomPresetTile[];
  /** Set once they confirm, including when they switched. */
  confirmedId?: string;
  disabled?: boolean;
  onConfirm?: (presetId: string) => void;
}) {
  const titleId = useId();
  const [selected, setSelected] = useState(recommendedId);
  const [touched, setTouched] = useState(false);
  const [changing, setChanging] = useState(false);
  const [pending, setPending] = useState(false);
  const confirmed = Boolean(confirmedId);
  const displayId = confirmedId || selected;
  const look = lookFor(displayId, customPresets);
  const suggested = lookFor(recommendedId, customPresets);
  const switched = Boolean(look) && displayId !== recommendedId;

  useEffect(() => {
    if (!touched) setSelected(recommendedId);
  }, [recommendedId, touched]);

  useEffect(() => {
    if (!disabled && !confirmed) setPending(false);
  }, [disabled, confirmed]);

  if (!look) return null;

  return (
    <section aria-labelledby={titleId} className="mt-3 rounded-2xl border border-border bg-card">
      <div className="flex gap-3 p-3">
        <div className="w-16 shrink-0">
          <PresetPoster preset={look} className="aspect-square" />
        </div>
        <div className="min-w-0">
          <p id={titleId} className="text-sm font-medium">
            {look.name}
          </p>
          <p className="text-xs text-muted-foreground">{look.tagline}</p>
          {reason && !switched ? <p className="mt-1 text-xs text-muted-foreground">{reason}</p> : null}
          {switched && !confirmed && suggested ? (
            <p className="mt-1 text-xs text-muted-foreground">Suggested look: {suggested.name}</p>
          ) : null}
        </div>
      </div>
      {confirmed ? (
        <p className="flex items-center gap-2 border-t border-border px-3 py-3 text-sm font-medium" role="status">
          <Check className="size-4 text-primary" aria-hidden />
          Using {look.name}.
        </p>
      ) : (
        <div className="border-t border-border px-3 py-3">
          {changing ? (
            <div className="mb-3">
              <PresetPicker
                engine={engine}
                value={selected}
                onChange={(id) => {
                  setTouched(true);
                  setSelected(id);
                }}
                customPresets={[...customPresets]}
                hideCreate
                disabled={disabled || pending}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl px-4"
              aria-expanded={changing}
              disabled={disabled || pending}
              onClick={() => setChanging((open) => !open)}
            >
              {changing ? "Hide styles" : "Choose a different look"}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-xl px-4"
              disabled={disabled || pending || !onConfirm}
              onClick={() => {
                if (!onConfirm || pending) return;
                setPending(true);
                onConfirm(selected);
              }}
            >
              {pending ? "Confirming…" : `Use ${look.name}`}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Pictures start after you confirm.</p>
        </div>
      )}
    </section>
  );
}
