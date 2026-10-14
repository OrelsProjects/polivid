"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GENERATION_MODELS, type GenerationModelId } from "@/lib/video/models";

export function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: GenerationModelId;
  onChange: (id: GenerationModelId) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const panelId = useId();
  const selected = GENERATION_MODELS.find((model) => model.id === value) ?? GENERATION_MODELS[0];

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleGroupKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = GENERATION_MODELS.findIndex((model) => model.id === value);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onChange(GENERATION_MODELS[(index + 1) % GENERATION_MODELS.length].id);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onChange(GENERATION_MODELS[(index - 1 + GENERATION_MODELS.length) % GENERATION_MODELS.length].id);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <span id={labelId} className="text-sm font-medium">
          Generation model
        </span>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="About generation models"
          onClick={() => setOpen((current) => !current)}
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          <CircleHelp className="size-3.5" />
        </button>
      </div>

      <div
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={handleGroupKeyDown}
        className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1 sm:grid-cols-4"
      >
        {GENERATION_MODELS.map((model) => {
          const active = model.id === value;
          return (
            <button
              key={model.id}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => {
                onChange(model.id);
                setOpen(true);
              }}
              className={cn(
                "min-h-11 rounded-lg px-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:text-sm",
                active
                  ? "bg-card text-foreground shadow-sm ring-1 ring-primary/50"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {model.name}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{selected.summary}</p>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Pick your generation model"
          className="absolute top-full right-0 left-0 z-30 mt-2 rounded-2xl border border-border bg-popover p-4 shadow-xl"
        >
          <p className="text-sm font-medium">Pick your generation model</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This model films the prompt. The player shows that footage.
          </p>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {GENERATION_MODELS.map((model) => {
              const active = model.id === value;
              return (
                <button
                  key={model.id}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => {
                    onChange(model.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-44 shrink-0 flex-col gap-2 rounded-xl p-2 text-left transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                    active ? "bg-primary/10 ring-1 ring-primary/60" : "hover:bg-muted/70",
                  )}
                >
                  <ModelPreview />
                  <span className="flex flex-col gap-0.5 px-1 pb-1">
                    <span className="text-sm font-semibold">{model.name}</span>
                    <span className="text-xs leading-snug text-muted-foreground">{model.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** A frame, not a chart. These models film the prompt. */
function ModelPreview() {
  return (
    <div aria-hidden className="relative grid h-24 place-items-center overflow-hidden rounded-lg bg-[#0A0E1A]">
      <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_20%_0%,#243056,transparent)]" />
      <div className="relative size-8 rounded-full border-2 border-[#FFB020]" />
    </div>
  );
}
