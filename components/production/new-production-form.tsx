"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MediaUpload } from "@/components/media-upload";
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

const pauseForPaint = () => new Promise<void>((resolve) => window.setTimeout(resolve, 280));

export function NewProductionForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"review" | "auto">("review");
  const [delegated, setDelegated] = useState(false);
  const [format, setFormat] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [durationSec, setDurationSec] = useState(30);
  const [referenceKeys, setReferenceKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [items, setItems] = useState<StatusItem[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

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
      className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div className="flex flex-col gap-1">
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
          aria-label="Production idea"
          disabled={pending}
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
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Format</span>
          <select
            className="rounded-lg border border-input bg-background px-2 py-1"
            value={format}
            onChange={(event) => setFormat(event.target.value as typeof format)}
            aria-label="Format"
            disabled={pending}
          >
            <option value="9:16">9:16</option>
            <option value="16:9">16:9</option>
            <option value="1:1">1:1</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Seconds</span>
          <input
            type="number"
            min={5}
            max={180}
            className="w-20 rounded-lg border border-input bg-background px-2 py-1"
            value={durationSec}
            onChange={(event) => setDurationSec(Number(event.target.value))}
            aria-label="Target duration in seconds"
            disabled={pending}
          />
        </label>
        <fieldset className="flex items-center gap-3" disabled={pending}>
          <legend className="sr-only">Mode</legend>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="mode"
              checked={mode === "review"}
              onChange={() => setMode("review")}
            />
            Review plan
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" name="mode" checked={mode === "auto"} onChange={() => setMode("auto")} />
            Automatic
          </label>
        </fieldset>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={delegated}
            onChange={(event) => setDelegated(event.target.checked)}
            disabled={pending}
          />
          Delegate creative choices
        </label>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {pending && items.length > 0 && (
        <StatusTimeline items={items} elapsed={elapsed} currentLabel={current?.label} />
      )}
      <Button type="submit" disabled={pending || text.trim().length < 3} aria-live="polite">
        {pending ? (current?.label ?? "Planning…") : "Develop plan"}
      </Button>
    </form>
  );
}
