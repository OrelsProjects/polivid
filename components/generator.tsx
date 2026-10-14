"use client";

import {
  ArrowRight,
  Circle,
  CircleCheck,
  LoaderCircle,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ModelPicker } from "@/components/model-picker";
import { PreviewSample, StylePoster } from "@/components/style-frame";
import { StartWorkerButton } from "@/components/start-worker-button";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { isJobStep, JOB_STEPS, stepIsComplete, type JobStep, type VideoJobView } from "@/lib/video/job-status";
import { generationModelById, generationModelBySlug, type GenerationModelId } from "@/lib/video/models";
import { isVideoLength, MAX_VIDEO_LENGTH, MIN_VIDEO_LENGTH, type VideoFormat } from "@/lib/video/schema";
import type { VisualStyle } from "@/lib/showcase";

const FORMATS: { value: VideoFormat; label: string; hint: string; icon: typeof Square }[] = [
  { value: "9:16", label: "Vertical", hint: "Shorts, TikTok, Reels", icon: RectangleVertical },
  { value: "1:1", label: "Square", hint: "Feeds, LinkedIn", icon: Square },
  { value: "16:9", label: "Wide", hint: "YouTube, Substack", icon: RectangleHorizontal },
];

const STYLES: { id: VisualStyle; title: string; body: string; soon?: boolean }[] = [
  { id: "bold", title: "Bold", body: "Big type, amber on navy" },
  { id: "minimal", title: "Minimal", body: "Light, quiet, lots of air", soon: true },
  { id: "editorial", title: "Editorial", body: "Serif, cream, magazine feel", soon: true },
];

const INPUTS = [
  { id: "topic", label: "Topic" },
  { id: "article", label: "Paste text" },
  { id: "data", label: "Data story" },
] as const;

type InputMode = (typeof INPUTS)[number]["id"];

const PLACEHOLDERS: Record<InputMode, string> = {
  topic: "Why sleep matters for memory. Three things that happen while you're out cold, for a general audience.",
  article: "Paste a newsletter, post, or notes. Mention the audience and the angle.",
  data: "Describe the data story. Name the figures you want on screen. Numbers still have to come from a source.",
};

const STEP_LABEL: Record<JobStep, string> = {
  script: "Writing the script",
  images: "Making the frames",
  videos: "Filming the scenes",
  render: "Stitching the video",
  finalize: "Finishing up",
};

const LENGTH_CHOICES = [30, 60, 90] as const;
const DEFAULT_CUSTOM_LENGTH = 5;

type Status =
  | { state: "idle" }
  | { state: "running"; jobId: string; step: JobStep | null; progress: number }
  | { state: "canceled" }
  | { state: "failed"; error: string; videoId: string | null };

const isFormat = (value: string | null): value is VideoFormat =>
  value === "9:16" || value === "1:1" || value === "16:9";

const isInput = (value: string | null): value is InputMode =>
  value === "topic" || value === "article" || value === "data";

export function Generator({ demo, defaultModel }: { demo: boolean; defaultModel: GenerationModelId }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? "";
  const requestedStyle = searchParams.get("style");
  const inputParam = searchParams.get("input");
  const formatParam = searchParams.get("format");
  const lengthParam = Number(searchParams.get("length"));
  const lengthFromUrl = isVideoLength(lengthParam);
  const presetFromUrl = lengthFromUrl && (LENGTH_CHOICES as readonly number[]).includes(lengthParam);
  const modelParam = searchParams.get("model");
  const modelFromUrl = modelParam
    ? (generationModelById(modelParam)?.id ?? generationModelBySlug(modelParam)?.id ?? null)
    : null;
  const [prompt, setPrompt] = useState(initialPrompt);
  const [inputMode, setInputMode] = useState<InputMode>(isInput(inputParam) ? inputParam : "topic");
  const [format, setFormat] = useState<VideoFormat>(isFormat(formatParam) ? formatParam : "9:16");
  const [length, setLength] = useState(lengthFromUrl ? lengthParam : DEFAULT_CUSTOM_LENGTH);
  const [customLength, setCustomLength] = useState(
    presetFromUrl ? "" : String(lengthFromUrl ? lengthParam : DEFAULT_CUSTOM_LENGTH),
  );
  const [model, setModel] = useState<GenerationModelId>(modelFromUrl ?? defaultModel);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [improving, setImproving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const cancelRequested = useRef(false);
  const running = status.state === "running";
  const busy = running || improving || submitting || canceling;
  const styleNote = requestedStyle === "minimal" || requestedStyle === "editorial";
  const activeLength = customLength === "" ? length : Number(customLength);
  const lengthValid = isVideoLength(activeLength);

  const generate = async (text = prompt) => {
    const value = text.trim();
    if (!value || busy || !lengthValid) return;
    cancelRequested.current = false;
    setSubmitting(true);

    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: value, format, length: activeLength, model }),
      });
      if (res.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/create")}`);
        return;
      }
      const body = (await res.json().catch(() => null)) as { jobId?: string; error?: string } | null;
      if (res.status !== 202 || !body?.jobId) {
        throw new Error(body?.error ?? "Couldn't queue the video.");
      }
      setStatus({ state: "running", jobId: body.jobId, step: null, progress: 0 });
    } catch (error) {
      setStatus({
        state: "failed",
        error: error instanceof Error ? error.message : String(error),
        videoId: null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const watchedJobId = status.state === "running" ? status.jobId : null;

  useEffect(() => {
    if (!watchedJobId) return;
    let stopped = false;

    const tick = async () => {
      const response = await fetch(`/api/videos/${watchedJobId}`, { cache: "no-store" });
      if (!response.ok || stopped || cancelRequested.current) return;
      const job = (await response.json()) as VideoJobView;
      if (stopped || cancelRequested.current) return;
      if (job.status === "succeeded") {
        router.push(`/videos/${job.id}`);
        return;
      }
      if (job.status === "canceled") {
        setStatus({ state: "canceled" });
        return;
      }
      if (job.status === "failed") {
        setStatus({ state: "failed", error: job.error ?? "The video didn't finish.", videoId: job.id });
        return;
      }
      setStatus({
        state: "running",
        jobId: job.id,
        step: isJobStep(job.currentStep) ? job.currentStep : null,
        progress: job.progressPct,
      });
    };

    void tick();
    const timer = setInterval(() => void tick(), 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [router, watchedJobId]);

  useEffect(() => {
    let stopped = false;
    const loadActive = async () => {
      const response = await fetch("/api/videos?status=active", { cache: "no-store" });
      if (!response.ok || stopped || cancelRequested.current) return;
      const body = (await response.json().catch(() => null)) as { jobs?: VideoJobView[] } | null;
      const job = body?.jobs?.[0];
      if (!job || stopped || cancelRequested.current) return;
      setStatus((current) => {
        if (current.state !== "idle") return current;
        return {
          state: "running",
          jobId: job.id,
          step: isJobStep(job.currentStep) ? job.currentStep : null,
          progress: job.progressPct,
        };
      });
    };
    void loadActive();
    return () => {
      stopped = true;
    };
  }, []);

  const handleImprove = async () => {
    const description = prompt.trim();
    if (description.length < 3 || busy) return;
    setImproving(true);
    setImproveError(null);
    try {
      const response = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/create")}`);
        return;
      }
      const body = (await response.json().catch(() => null)) as { script?: string; error?: string } | null;
      if (!response.ok || !body?.script) {
        throw new Error(body?.error ?? "Couldn't improve that.");
      }
      setPrompt(body.script);
    } catch (error) {
      setImproveError(error instanceof Error ? error.message : "Couldn't improve that.");
    } finally {
      setImproving(false);
    }
  };

  const handleCancel = async () => {
    if (status.state !== "running" || canceling) return;
    cancelRequested.current = true;
    setCanceling(true);
    try {
      const response = await fetch(`/api/videos/${status.jobId}/cancel`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 401) {
        cancelRequested.current = false;
        router.push(`/login?callbackUrl=${encodeURIComponent("/create")}`);
        return;
      }
      if (!response.ok) throw new Error(body?.error ?? "Couldn't cancel the video.");
      setStatus({ state: "canceled" });
    } catch (error) {
      cancelRequested.current = false;
      setStatus({
        state: "failed",
        error: error instanceof Error ? error.message : "Couldn't cancel the video.",
        videoId: status.state === "running" ? status.jobId : null,
      });
    } finally {
      setCanceling(false);
    }
  };

  useEffect(() => {
    if (autoStarted.current || searchParams.get("start") !== "1" || !prompt.trim()) return;
    autoStarted.current = true;
    void generate();
    // Runs once for a prompt handed over from the dashboard or landing page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Let&apos;s configure your video</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ready in minutes. Preview everything before you post.</p>
        </div>

        {demo && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
            Demo mode: no API key is set, so every video uses fictional sample data.
          </div>
        )}
        {styleNote && (
          <p className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
            {requestedStyle === "minimal" ? "Minimal" : "Editorial"} is next. This video will use Bold.
          </p>
        )}

        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">1 · Your input</h2>
            <div className="flex rounded-xl bg-muted p-1" role="tablist" aria-label="Input type">
              {INPUTS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={inputMode === id}
                  disabled={busy}
                  onClick={() => setInputMode(id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    inputMode === id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
              <span className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground/70">
                Script
                <span className="text-[10px] font-semibold tracking-wide">SOON</span>
              </span>
            </div>
          </div>
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void generate();
              }
            }}
            rows={4}
            disabled={busy}
            placeholder={PLACEHOLDERS[inputMode]}
            aria-label="Your video prompt"
            className="mt-3 min-h-28 resize-none rounded-xl bg-background text-base md:text-sm"
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={demo || busy || prompt.trim().length < 3}
              onClick={() => {
                void handleImprove();
              }}
            >
              {improving ? (
                <>
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                  Improving…
                </>
              ) : (
                "Improve with AI"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Natural language works. Mention the audience, the angle, and anything you want on screen.
            </p>
          </div>
          {improveError && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {improveError}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">2 · Visual style</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STYLES.map((style) => (
              <div key={style.id} className="flex flex-col gap-2">
                <StylePoster
                  style={style.id}
                  title="40%"
                  size="picker"
                  className={cn("aspect-[3/4] w-full", style.id === "bold" && "ring-2 ring-primary ring-offset-2")}
                />
                <div>
                  <p className="text-sm font-medium">
                    {style.title}
                    {style.soon && (
                      <span className="ml-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground">SOON</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{style.body}</p>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2">
              <div className="grid aspect-[3/4] place-items-center rounded-2xl border border-dashed border-border bg-muted/40 text-muted-foreground">
                <span className="text-2xl" aria-hidden>
                  +
                </span>
              </div>
              <div>
                <p className="text-sm font-medium">
                  Brand kit
                  <span className="ml-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground">SOON</span>
                </p>
                <p className="text-xs text-muted-foreground">Logo, colors, font</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">3 · Format and length</h2>
          <fieldset className="mt-3" disabled={busy}>
            <legend className="sr-only">Format</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {FORMATS.map(({ value, label, hint, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={format === value}
                  onClick={() => setFormat(value)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition",
                    format === value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="block font-medium text-foreground">{label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {value} · {hint}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-muted-foreground">Length</span>
            {LENGTH_CHOICES.map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                aria-pressed={customLength === "" && length === value}
                onClick={() => {
                  setCustomLength("");
                  setLength(value);
                }}
                className={cn(
                  "h-9 rounded-xl px-3 text-sm font-medium transition disabled:opacity-50",
                  customLength === "" && length === value
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {value}s
              </button>
            ))}
            <label
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition",
                customLength !== "" ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
            >
              <span>Custom</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Custom length in seconds"
                disabled={busy}
                value={customLength}
                placeholder="8"
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
                  setCustomLength(digits);
                  if (digits === "") {
                    setLength((current) => ((LENGTH_CHOICES as readonly number[]).includes(current) ? current : 60));
                    return;
                  }
                  const parsed = Number(digits);
                  if (isVideoLength(parsed)) setLength(parsed);
                }}
                className="w-8 bg-transparent text-center text-inherit tabular-nums outline-none placeholder:text-current/40 disabled:opacity-50"
              />
              <span className="text-xs">s</span>
            </label>
            <span className="text-xs text-muted-foreground">
              {customLength !== "" && !isVideoLength(Number(customLength))
                ? `Use a whole number from ${MIN_VIDEO_LENGTH} to ${MAX_VIDEO_LENGTH}.`
                : `${MIN_VIDEO_LENGTH}–${MAX_VIDEO_LENGTH} seconds. A model shortens anything longer than it can film.`}
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">4 · Voice, media and extras</h2>
          <div className="mt-4">
            <ModelPicker value={model} onChange={setModel} disabled={busy} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Voice</span>
            <span className="rounded-xl border border-dashed border-border px-3 py-2 text-muted-foreground">
              Narrator · coming next
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Media">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              Motion graphics
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
              Stock images and video
              <span className="text-[10px] font-semibold tracking-wide">SOON</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
              Your uploads
              <span className="text-[10px] font-semibold tracking-wide">LATER</span>
            </span>
          </div>
          <ul className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <li className="rounded-xl bg-muted/60 px-3 py-2">
              <span className="block font-medium text-foreground">Captions</span>
              Word by word, on the preview
            </li>
            <li className="rounded-xl bg-muted/60 px-3 py-2">
              <span className="block font-medium text-foreground">Background music</span>
              Coming next
            </li>
            <li className="rounded-xl bg-muted/60 px-3 py-2">
              <span className="block font-medium text-foreground">Sources card</span>
              Closing scene, when facts are used
            </li>
          </ul>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {demo ? "Uses sample data · " : ""}
            You can close this tab. The video keeps generating.
          </p>
          <Button type="submit" size="lg" disabled={!prompt.trim() || busy || !lengthValid} className="h-11 rounded-xl px-5">
            {running || submitting ? (
              <>
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
                Generating…
              </>
            ) : (
              <>
                Generate video
                <ArrowRight data-icon="inline-end" />
              </>
            )}
          </Button>
        </div>
      </form>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Preview</span>
          <span className="text-muted-foreground">Bold · {format} · {lengthValid ? `${activeLength}s` : "custom"}</span>
        </div>
        <PreviewSample />
        <dl className="grid grid-cols-2 gap-y-2 rounded-2xl border border-border bg-white p-4 text-xs shadow-sm">
          <dt className="text-muted-foreground">Picture</dt>
          <dd className="text-right font-medium">Filmed by the model</dd>
          <dt className="text-muted-foreground">Length</dt>
          <dd className="text-right font-medium">Snaps to the model max</dd>
          <dt className="text-muted-foreground">Sound</dt>
          <dd className="text-right font-medium">When the model has it</dd>
          <dt className="text-muted-foreground">Export</dt>
          <dd className="text-right font-medium">MP4 download</dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          The frame on the right is a style sample. Generate films the prompt with the model you picked.
        </p>

        {status.state === "running" && (
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <h2 className="text-sm font-medium">Progress{status.state === "running" ? ` · ${status.progress}%` : ""}</h2>
            {status.step === "videos" && (
              <p className="mt-2 text-xs text-muted-foreground">
                Waiting on the video model. This often takes 20–30 minutes, and sometimes longer. The percentage stays here until the file comes back.
              </p>
            )}
            <ol className="mt-3 flex flex-col gap-3">
              {JOB_STEPS.map((step, index) => {
                const current =
                  status.state === "running" && status.step ? JOB_STEPS.indexOf(status.step) : -1;
                const done =
                  status.state === "running" && status.step ? stepIsComplete(step, status.step, status.progress) : false;
                const active = status.state === "running" && index === current;
                const waiting = status.state === "running" && current < 0 && index === 0;
                return (
                  <li key={step} className="flex items-center gap-3 text-sm">
                    {done ? (
                      <CircleCheck className="size-4 text-primary" aria-hidden />
                    ) : active || waiting ? (
                      <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden />
                    ) : (
                      <Circle className="size-4 text-muted-foreground/50" aria-hidden />
                    )}
                    <span className={cn(done || active || waiting ? "text-foreground" : "text-muted-foreground")}>
                      {waiting ? "Queued" : STEP_LABEL[step]}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {status.step === null && (
                <StartWorkerButton hint="For testing. Films the videos that are queued." />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={canceling}
                aria-label="Cancel this video"
                aria-busy={canceling}
                onClick={() => {
                  void handleCancel();
                }}
              >
                {canceling ? "Canceling…" : "Cancel"}
              </Button>
            </div>
          </div>
        )}

        {status.state === "canceled" && (
          <p className="rounded-xl border border-border bg-white px-3 py-2 text-sm text-muted-foreground">
            Canceled. Nothing else will run for that video.
          </p>
        )}

        {status.state === "failed" && (
          <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-red-50 p-3 text-sm" role="alert">
            <span className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden />
              Couldn&apos;t make this video
            </span>
            <span className="text-muted-foreground">{status.error}</span>
            {status.videoId && (
              <Link href={`/videos/${status.videoId}`} className="text-primary underline-offset-4 hover:underline">
                See what was found
              </Link>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
