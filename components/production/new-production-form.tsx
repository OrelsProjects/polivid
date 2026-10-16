"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MediaUpload } from "@/components/media-upload";
import { PresetPicker } from "@/components/preset-picker";
import { CharacterPicker } from "@/components/characters/character-picker";
import { STUDIO_VOICE_ID } from "@/lib/voice/constants";
import { VisualDirectionField } from "@/components/visual-direction-field";
import { StatusTimeline } from "@/components/production/status-timeline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { isNdjson, readNdjson } from "@/lib/http/ndjson";
import {
  applyPlanningProgress,
  formatElapsed,
  planningItemsFromKey,
  type StatusItem,
} from "@/lib/production/progress";
import type { ProductionStreamEvent } from "@/lib/production/stream";
import { cn } from "@/lib/utils";

const FIELD_CLASS =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:text-sm";

const pauseForPaint = () => new Promise<void>((resolve) => window.setTimeout(resolve, 280));

export function NewProductionForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"review" | "auto">("review");
  const [delegated, setDelegated] = useState(false);
  const [format, setFormat] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [durationSec, setDurationSec] = useState(30);
  const [referenceKeys, setReferenceKeys] = useState<string[]>([]);
  const [presetId, setPresetId] = useState("auto");
  const [visualDirection, setVisualDirection] = useState("");
  const [characterId, setCharacterId] = useState(STUDIO_VOICE_ID);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [items, setItems] = useState<StatusItem[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!pending || !startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending, startedAt]);

  const current =
    items.find((item) => item.state === "active") ?? [...items].reverse().find((item) => item.state === "done");
  const elapsed = startedAt ? formatElapsed(startedAt, now) : null;

  const handleSubmit = async () => {
    setPending(true);
    setError(null);
    setStartedAt(Date.now());
    setNow(Date.now());
    setItems(planningItemsFromKey("save", "active"));
    try {
      const response = await fetch("/api/productions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          text,
          mode,
          creativeDelegation: delegated,
          format,
          durationSec,
          referenceKeys,
          presetId,
          visualDirection,
          characterId,
        }),
      });
      if (!isNdjson(response)) {
        const json = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(json?.error ?? "Couldn't start that production.");
        return;
      }
      let productionId: string | undefined;
      for await (const event of readNdjson<ProductionStreamEvent>(response)) {
        if (event.type === "created") {
          productionId = event.id;
          setItems((currentItems) => applyPlanningProgress(currentItems, event));
          router.refresh();
          await pauseForPaint();
          continue;
        }
        if (event.type === "progress") {
          setItems((currentItems) => applyPlanningProgress(currentItems, event));
          await pauseForPaint();
          continue;
        }
        if (event.type === "done") {
          productionId = event.id;
          router.push(`/productions/${event.id}`);
          return;
        }
        if (event.type === "error") {
          productionId = event.id ?? productionId;
          setError(event.error);
          if (event.id) {
            router.push(`/productions/${event.id}`);
            return;
          }
        }
      }
      if (productionId) {
        router.push(`/productions/${productionId}`);
        return;
      }
      setError("Couldn't start that production.");
    } catch {
      setError("Couldn't start that production.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-5 rounded-2xl border border-border bg-white p-5 shadow-sm"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="production-input" className="text-sm font-medium">
          Idea, outline, or script
        </label>
        <Textarea
          id="production-input"
          name="text"
          rows={8}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="A woman waits at a kitchen table with an unopened letter…"
          disabled={pending}
          className="rounded-xl bg-background"
        />
      </div>
      <MediaUpload
        kind="image"
        multiple
        mediaKeys={referenceKeys}
        onChangeKeys={setReferenceKeys}
        disabled={pending}
        label="Reference pictures"
        hint="Optional. Faces, places, or the look you want · JPEG, PNG, or WebP under 4 MB"
      />
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-medium">Format</span>
            <select
              className={FIELD_CLASS}
              value={format}
              onChange={(event) => setFormat(event.target.value as typeof format)}
              disabled={pending}
            >
              <option value="9:16">9:16 · Vertical</option>
              <option value="16:9">16:9 · Wide</option>
              <option value="1:1">1:1 · Square</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-medium">Length (seconds)</span>
            <input
              type="number"
              inputMode="numeric"
              min={5}
              max={180}
              className={cn(FIELD_CLASS, "tabular-nums")}
              value={durationSec}
              onChange={(event) => setDurationSec(Number(event.target.value))}
              disabled={pending}
            />
          </label>
        </div>
        <fieldset className="flex flex-col gap-1.5" disabled={pending}>
          <legend className="mb-1.5 font-medium">Plan review</legend>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex min-h-10 cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "review"}
                onChange={() => setMode("review")}
                className="size-4 accent-primary"
              />
              Review the plan first
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="mode"
                checked={mode === "auto"}
                onChange={() => setMode("auto")}
                className="size-4 accent-primary"
              />
              Automatic
            </label>
          </div>
        </fieldset>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Visual style</p>
        <PresetPicker engine="footage" value={presetId} onChange={setPresetId} disabled={pending} hideCreate />
        <VisualDirectionField value={visualDirection} onChange={setVisualDirection} disabled={pending} />
        <div className="mt-4">
          <CharacterPicker
            value={characterId}
            onChange={setCharacterId}
            disabled={pending}
            allowOff={false}
            studioLabel="Plan voice"
            detail="A character speaks every line and adds their picture as a reference. Plan voice keeps the voice written into the plan."
          />
        </div>
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={delegated}
          onChange={(event) => setDelegated(event.target.checked)}
          disabled={pending}
          className="size-4 accent-primary"
        />
        Delegate creative choices
      </label>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {pending && items.length > 0 && (
        <StatusTimeline items={items} elapsed={elapsed} currentLabel={current?.label} />
      )}
      <Button
        type="submit"
        size="lg"
        disabled={pending || text.trim().length < 3}
        aria-live="polite"
        className="h-11 rounded-xl px-5 sm:self-end"
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden />
            {current?.label ?? "Planning…"}
          </>
        ) : (
          "Develop plan"
        )}
      </Button>
    </form>
  );
}
