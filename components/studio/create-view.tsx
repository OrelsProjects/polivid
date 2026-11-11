"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Card, Chip, Kicker, PrototypePill, SectionTitle, toggle, type Tone } from "./studio-ui";
import { STUDIO_HREF } from "./studio-links";

/* Port of design/studio-prototype/Create.dc.html: one screen, four stages, shared state. */

type Stage = "configure" | "script" | "render" | "output";

const STEPS: { id: Stage; label: string }[] = [
  { id: "configure", label: "Configure" },
  { id: "script", label: "Script & scenes" },
  { id: "render", label: "Render" },
  { id: "output", label: "Output" },
];

const INPUTS = [
  { id: "idea", label: "Idea", hint: "Describe what the video is about" },
  { id: "script", label: "Exact script", hint: "Paste the words. They will be used as written" },
  { id: "writing", label: "Article or link", hint: "Paste a post or a URL. Up to three concepts are suggested" },
  { id: "music", label: "Music or audio", hint: "Upload a track. Scenes follow the beat" },
];

const PRESENTATIONS: { id: string; label: string; hint: string; rate: number; rateLabel: string; disabled?: boolean }[] =
  [
    { id: "motion", label: "Motion graphics", hint: "Text, charts, quotes, sources", rate: 2, rateLabel: "2 credits / s" },
    { id: "scenes", label: "Generated scenes", hint: "Filmed by the model", rate: 10, rateLabel: "10 credits / s" },
    { id: "illustration", label: "Illustration", hint: "Stills that start to move", rate: 4, rateLabel: "4 credits / s" },
    {
      id: "media",
      label: "Your media",
      hint: "Add footage or images first",
      rate: 1,
      rateLabel: "Needs supplied media",
      disabled: true,
    },
  ];

const STYLES = [
  { id: "auto", label: "Auto", hint: "From the brief", swatch: "bg-border text-foreground/80", mark: "Auto" },
  { id: "bold", label: "Bold", hint: "Big type, amber on navy", swatch: "bg-foreground text-amber-400", mark: "BOLD" },
  { id: "editorial", label: "Editorial", hint: "Serif, cream, magazine", swatch: "bg-amber-400/10 text-foreground", mark: "Ed." },
  { id: "minimal", label: "Minimal", hint: "Light, quiet, lots of air", swatch: "bg-card text-muted-foreground", mark: "—" },
  { id: "rounded", label: "Rounded 3D", hint: "Soft animated characters", swatch: "bg-sky-400/15 text-sky-300", mark: "3D" },
  { id: "realism", label: "Ultra realism", hint: "Believable light", swatch: "bg-emerald-400/15 text-emerald-300", mark: "Real" },
];

const FORMATS = [
  { id: "9:16", label: "Vertical", hint: "9:16 · Shorts, Reels" },
  { id: "1:1", label: "Square", hint: "1:1 · Feeds" },
  { id: "16:9", label: "Wide", hint: "16:9 · YouTube, Substack" },
];

const LENGTHS = [30, 60, 90];

const VOICES = ["Narrator (written into the plan)", "Orel · recorded voice", "No voice · captions only"];

type Scene = { title: string; text: string; onscreen: string; visual: string; seconds: number };

const SCENES: Scene[] = [
  {
    title: "Hook",
    text: "You forget forty percent of what you learned today unless you sleep on it.",
    onscreen: "40% gone by tomorrow",
    visual: "Big number, counting down",
    seconds: 7,
  },
  {
    title: "Replay",
    text: "While you are out cold, the hippocampus replays the day and files the keepers into long-term storage.",
    onscreen: "Replay → file → keep",
    visual: "Three-step diagram",
    seconds: 13,
  },
  {
    title: "Takeaway",
    text: "Study, then sleep. One night is worth more than one more hour of cramming.",
    onscreen: "Study. Then sleep.",
    visual: "Closing card with the line",
    seconds: 10,
  },
];

/** Selected = primary ring + tint, text colour left to the caller. */
function picked(on: boolean) {
  return on ? "border-primary bg-accent" : "border-border bg-card";
}

function stepLook(current: boolean, past: boolean) {
  if (current) return "bg-primary text-white";
  if (past) return "bg-accent text-primary";
  return "bg-card text-muted-foreground";
}

const fieldLabel = "text-[13px] font-medium text-foreground/80";
const quietButton =
  "cursor-pointer rounded-full border border-border bg-card font-medium text-foreground/80";
const primaryButton = "h-11 cursor-pointer rounded-full border-0 bg-primary font-medium text-white";

const modeFor = (input: string, presentation: string) => {
  if (input === "music") return "music";
  if (input === "script" || input === "writing") return "voiceover";
  if (presentation === "scenes") return "prompt";
  if (presentation === "illustration") return "image";
  return "motion-graphics";
};

export function CreateView() {
  const router = useRouter();
  const params = useSearchParams();
  const [stage, setStage] = useState<Stage>("configure");
  const [error, setError] = useState("");
  const [input, setInput] = useState("idea");
  const [brief, setBrief] = useState(params.get("brief") || "");
  const [presentation, setPresentation] = useState("motion");
  const [style, setStyle] = useState("bold");
  const [format, setFormat] = useState(params.get("format") || "9:16");
  const [length, setLength] = useState(Number(params.get("length")) || 30);
  const [selectedScene, setSelectedScene] = useState(0);
  const [progress, setProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [scenes, setScenes] = useState<Scene[]>(SCENES);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopTimer() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  useEffect(() => {
    const ref = timer;
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, []);

  async function startRender() {
    setError("");
    setStage("render");
    setProgress(8);
    stopTimer();
    const script = scenes.map((scene) => scene.text.trim()).filter(Boolean).join("\n\n") || brief.trim();
    try {
      const response = await fetch("/api/videos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: script,
          format,
          length,
          mode: modeFor(input, presentation),
          tier: "pro",
          visualDirection: style === "auto" ? "" : style,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { jobId?: string; error?: string } | null;
      if (!response.ok || !payload?.jobId) {
        throw new Error(payload?.error || "Couldn't start the video.");
      }
      router.push(`/studio/projects/${payload.jobId}`);
    } catch (cause) {
      stopTimer();
      setStage("script");
      setError(cause instanceof Error ? cause.message : "Couldn't start the video.");
    }
  }

  function cancelRender() {
    stopTimer();
    setStage("script");
    setProgress(0);
  }

  function restart() {
    setStage("configure");
    setProgress(0);
    setDownloaded(false);
  }

  function editScene(index: number, patch: Partial<Scene>) {
    setScenes((list) => list.map((scene, i) => (i === index ? { ...scene, ...patch } : scene)));
  }

  const stageIndex = STEPS.findIndex((step) => step.id === stage);
  const current = INPUTS.find((item) => item.id === input);
  const pres = PRESENTATIONS.find((item) => item.id === presentation);
  const rate = pres?.rate ?? 0;
  const cost = (length * rate).toLocaleString("en-US");
  const summaryPresentation = pres ? pres.label : "";
  const summaryLength = `${length}s`;
  const summaryFormat = format;
  const summaryStyle = (STYLES.find((item) => item.id === style) ?? STYLES[0]).label;
  const sceneCount = `${scenes.length} scenes`;
  const selectedIndex = scenes[selectedScene] ? selectedScene : 0;
  const selected = scenes[selectedIndex];
  const doneScenes = Math.floor((progress / 100) * scenes.length);
  const renderScene = Math.min(scenes.length, doneScenes + 1);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="m-0 font-heading text-[30px] leading-[1.15] font-semibold tracking-normal">New video</h1>
            <p className="m-0 text-[15px] text-muted-foreground">
              Idea to MP4. Review the script and the cost before anything renders.
            </p>
          </div>
          <PrototypePill>Starts a real video job</PrototypePill>
        </div>
        <ol aria-label="Steps" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {STEPS.map((step, i) => {
            const isCurrent = step.id === stage;
            return (
              <li
                key={step.id}
                aria-current={isCurrent ? "step" : "false"}
                className={cn(
                  "inline-flex h-[34px] items-center gap-2 rounded-full pr-3 pl-1.5 text-[13px] font-medium",
                  stepLook(isCurrent, i < stageIndex),
                )}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-[22px] items-center justify-center rounded-full border border-border bg-card text-[12px] font-semibold text-foreground"
                >
                  {i + 1}
                </span>
                {step.label}
              </li>
            );
          })}
        </ol>
      </header>

      {stage === "configure" ? (
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
            <Card aria-labelledby="in-title" className="gap-3.5 px-[22px] py-5">
              <Kicker id="in-title">1 · Your input</Kicker>
              <div role="group" aria-label="Input kind" className="flex flex-wrap gap-2">
                {INPUTS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={input === item.id}
                    onClick={() => setInput(item.id)}
                    className={cn("h-9 cursor-pointer rounded-full border px-3.5 font-medium", toggle(input === item.id))}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <label htmlFor="brief" className={fieldLabel}>
                {current ? current.hint : "Brief"}
              </label>
              <textarea
                id="brief"
                rows={4}
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                className="min-h-[110px] w-full resize-y rounded-[14px] border border-border bg-muted px-4 py-3.5 text-[15px] text-foreground"
              />
              <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-muted-foreground">
                <button type="button" className={cn(quietButton, "h-[34px] px-3")}>
                  Add reference pictures
                </button>
                <span>Optional · JPEG, PNG or WebP under 4 MB</span>
              </div>
            </Card>

            <Card aria-labelledby="pres-title" className="gap-3.5 px-[22px] py-5">
              <div className="flex flex-col gap-0.5">
                <Kicker id="pres-title">2 · Presentation</Kicker>
                <p className="m-0 text-[13px] text-muted-foreground">
                  How the video looks on screen. This is separate from what you started with.
                </p>
              </div>
              <div
                role="group"
                aria-label="Presentation"
                className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2.5"
              >
                {PRESENTATIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={presentation === item.id}
                    onClick={() => setPresentation(item.id)}
                    disabled={item.disabled}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-[14px] border p-3.5 text-left text-foreground",
                      picked(presentation === item.id),
                      item.disabled ? "opacity-[0.55]" : "opacity-100",
                    )}
                  >
                    <span className="text-[14px] font-semibold">{item.label}</span>
                    <span className="text-[12px] text-muted-foreground">{item.hint}</span>
                    <span className="text-[12px] font-medium text-primary">{item.rateLabel}</span>
                  </button>
                ))}
              </div>
            </Card>

            <Card aria-labelledby="style-title" className="gap-3.5 px-[22px] py-5">
              <Kicker id="style-title">3 · Style</Kicker>
              <div
                role="group"
                aria-label="Visual style"
                className="grid grid-cols-[repeat(auto-fit,minmax(min(120px,100%),1fr))] gap-2.5"
              >
                {STYLES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={style === item.id}
                    onClick={() => setStyle(item.id)}
                    className={cn(
                      "flex cursor-pointer flex-col gap-2 rounded-[14px] border-2 bg-card p-1.5 text-left text-foreground",
                      style === item.id ? "border-primary" : "border-white",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex aspect-square items-end rounded-[10px] p-2 font-heading text-[13px] font-bold",
                        item.swatch,
                      )}
                    >
                      {item.mark}
                    </span>
                    <span className="flex flex-col gap-0.5 px-1 pb-1">
                      <span className="text-[13px] font-semibold">{item.label}</span>
                      <span className="text-[12px] text-muted-foreground">{item.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Card>

            <Card aria-labelledby="fmt-title" className="gap-3.5 px-[22px] py-5">
              <Kicker id="fmt-title">4 · Format, length, voice</Kicker>
              <div className="flex flex-wrap gap-6">
                <div role="group" aria-label="Format" className="flex flex-col gap-2">
                  <span className={fieldLabel}>Format</span>
                  <div className="flex flex-wrap gap-2">
                    {FORMATS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={format === item.id}
                        onClick={() => setFormat(item.id)}
                        className={cn(
                          "inline-flex h-10 cursor-pointer flex-col justify-center rounded-[12px] border px-3.5 leading-[1.2] font-medium text-foreground",
                          picked(format === item.id),
                        )}
                      >
                        <span>{item.label}</span>
                        <span className="text-[11px] font-normal text-muted-foreground">{item.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div role="group" aria-label="Length" className="flex flex-col gap-2">
                  <span className={fieldLabel}>Length</span>
                  <div className="flex flex-wrap gap-2">
                    {LENGTHS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={length === n}
                        onClick={() => setLength(n)}
                        className={cn(
                          "h-10 min-w-14 cursor-pointer rounded-[12px] border px-3.5 font-medium text-foreground",
                          picked(length === n),
                        )}
                      >
                        {n}s
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-[1_1_220px] flex-col gap-2">
                  <label htmlFor="voice" className={fieldLabel}>
                    Voice
                  </label>
                  <select
                    id="voice"
                    className="h-10 rounded-[12px] border border-border bg-card px-3 text-foreground"
                  >
                    {VOICES.map((voice) => (
                      <option key={voice}>{voice}</option>
                    ))}
                  </select>
                </div>
              </div>
            </Card>
          </div>

          <aside
            aria-label="Cost and next step"
            className="sticky top-24 flex max-w-[360px] flex-[1_1_280px] flex-col gap-3.5"
          >
            <Card className="gap-3 px-[22px] py-5">
              <Kicker>Before you render</Kicker>
              <div className="flex items-baseline gap-2">
                <span className="font-heading text-[34px] leading-none font-bold">{cost}</span>
                <span className="text-muted-foreground">credits · estimate</span>
              </div>
              <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
                <dt className="text-muted-foreground">Presentation</dt>
                <dd className="m-0">{summaryPresentation}</dd>
                <dt className="text-muted-foreground">Length</dt>
                <dd className="m-0">{summaryLength}</dd>
                <dt className="text-muted-foreground">Format</dt>
                <dd className="m-0">{summaryFormat}</dd>
                <dt className="text-muted-foreground">Balance</dt>
                <dd className="m-0">8,198 credits (sample)</dd>
              </dl>
              <p className="m-0 text-[12px] text-muted-foreground">
                Credits are held when the render starts and refunded for any scene that fails. Nothing is charged for
                planning the script.
              </p>
              <button type="button" onClick={() => setStage("script")} className={primaryButton}>
                Plan script &amp; scenes
              </button>
            </Card>
            <Card className="gap-2 px-[18px] py-4">
              <h2 className="m-0 font-sans text-[13px] font-semibold tracking-normal">Coach</h2>
              <p className="m-0 text-[13px] text-foreground/80">
                Mention the audience and the one thing they should remember. A number on screen needs a source in the
                script.
              </p>
              <button type="button" className={cn(quietButton, "h-[34px] self-start px-3")}>
                Improve the brief
              </button>
            </Card>
          </aside>
        </div>
      ) : null}

      {stage === "script" ? (
        <div className="flex flex-wrap items-start gap-5">
          <section aria-label="Scenes" className="flex max-w-[340px] flex-[1_1_260px] flex-col gap-2.5">
            <div className="flex items-baseline justify-between">
              <SectionTitle size={18}>Scenes</SectionTitle>
              <span className="text-[12px] text-muted-foreground">
                {sceneCount} · {summaryLength}
              </span>
            </div>
            {scenes.map((scene, i) => (
              <button
                key={i}
                type="button"
                aria-pressed={selectedScene === i}
                onClick={() => setSelectedScene(i)}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-[14px] border-2 bg-card p-3 text-left text-foreground",
                  selectedScene === i ? "border-primary" : "border-border",
                )}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-12 flex-[0_0_48px] items-center justify-center rounded-[10px] bg-border font-semibold text-foreground/80"
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[14px] font-semibold">{scene.title}</span>
                  <span className="truncate text-[12px] text-muted-foreground">{scene.text}</span>
                  <span className="text-[12px] text-muted-foreground">{scene.seconds}s</span>
                </span>
              </button>
            ))}
            <button
              type="button"
              className="h-10 cursor-pointer rounded-[12px] border border-dashed border-input bg-transparent font-medium text-foreground/80"
            >
              + Add a scene
            </button>
          </section>

          <Card aria-label="Selected scene" className="min-w-0 flex-[999_1_420px] gap-3.5 px-[22px] py-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <SectionTitle size={18}>
                Scene {selectedIndex + 1} · {selected.title}
              </SectionTitle>
              <span className="text-[12px] text-muted-foreground">Edits here go into the render unchanged</span>
            </div>
            <label htmlFor="narration" className={fieldLabel}>
              Narration
            </label>
            <textarea
              id="narration"
              rows={4}
              value={selected.text}
              onChange={(event) => editScene(selectedIndex, { text: event.target.value })}
              className="w-full resize-y rounded-[14px] border border-border bg-muted px-3.5 py-3 text-[15px] text-foreground"
            />
            <label htmlFor="onscreen" className={fieldLabel}>
              On-screen text
            </label>
            <input
              id="onscreen"
              type="text"
              value={selected.onscreen}
              onChange={(event) => editScene(selectedIndex, { onscreen: event.target.value })}
              className="h-[42px] rounded-[12px] border border-border bg-muted px-3.5 text-[15px] text-foreground"
            />
            <div className="flex flex-col gap-1.5">
              <span className={fieldLabel}>Visual</span>
              <div className="flex items-center gap-3 rounded-[14px] border border-border p-3">
                <span aria-hidden="true" className="size-[72px] flex-[0_0_72px] rounded-[10px] bg-border" />
                <div className="flex flex-col gap-1 text-[13px]">
                  <span className="font-medium">{selected.visual}</span>
                  <span className="text-muted-foreground">
                    {summaryPresentation} · {summaryStyle}
                  </span>
                  <button type="button" className={cn(quietButton, "h-[30px] self-start px-2.5 text-[12px]")}>
                    Change visual note
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border pt-3.5">
              <div className="text-[13px] text-foreground/80">
                <strong className="font-semibold">{cost} credits</strong> will be held · refunded per failed scene
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setStage("configure")} className={cn(quietButton, "h-11 px-4")}>
                  Back to settings
                </button>
                <button type="button" onClick={startRender} className={cn(primaryButton, "px-5")}>
                  Approve script &amp; render
                </button>
                {error ? (
                  <p role="alert" className="basis-full text-[13px] text-red-300">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {stage === "render" ? (
        <section
          aria-label="Rendering"
          className="flex flex-wrap items-start gap-6 rounded-[20px] border border-border bg-card p-6"
        >
          <div
            aria-hidden="true"
            className="flex aspect-[9/16] w-[220px] items-center justify-center rounded-[14px] bg-foreground text-[13px] text-muted-foreground"
          >
            Rendering…
          </div>
          <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
            <div className="flex flex-col gap-1">
              <SectionTitle>
                Rendering · scene {renderScene} of {sceneCount}
              </SectionTitle>
              <p className="m-0 text-[13px] text-muted-foreground">
                You can leave. The job keeps running and the result lands in Projects.
              </p>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Render progress"
              className="h-2.5 overflow-hidden rounded-full bg-border"
            >
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              {scenes.map((scene, i) => {
                const done = i < doneScenes;
                const active = i === doneScenes;
                const tone: Tone = done ? "ready" : active ? "rendering" : "neutral";
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-muted px-3 py-2.5"
                  >
                    <span className="text-[14px]">
                      Scene {i + 1} · {scene.title}
                    </span>
                    <Chip tone={tone}>{done ? "Rendered" : active ? "Rendering" : "Queued"}</Chip>
                  </li>
                );
              })}
            </ol>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={cancelRender} className={cn(quietButton, "h-10 px-4")}>
                Cancel · refunds the hold
              </button>
              <span className="text-[12px] font-medium text-amber-300">
                Simulated render · no model is called, no credits move
              </span>
            </div>
          </div>
        </section>
      ) : null}

      {stage === "output" ? (
        <section
          aria-label="Output"
          className="flex flex-wrap items-start gap-6 rounded-[20px] border border-border bg-card p-6"
        >
          <div
            role="img"
            aria-label="Finished video placeholder"
            className="flex aspect-[9/16] w-[300px] flex-col justify-between rounded-[14px] bg-foreground p-3.5 text-[12px] text-white"
          >
            <span className="text-input">
              v1 · {summaryFormat} · {summaryLength}
            </span>
            <span className="font-heading text-[26px] leading-[1.1] font-bold">{selected.onscreen}</span>
          </div>
          <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Chip tone="ready" className="self-start">
                Ready · version 1
              </Chip>
              <SectionTitle size={22}>Why sleep matters for memory</SectionTitle>
              <p className="m-0 text-[13px] text-muted-foreground">
                {sceneCount} · {summaryPresentation} · {summaryStyle} · {cost} credits charged (sample)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setDownloaded(true)} className={cn(primaryButton, "px-5")}>
                Download MP4
              </button>
              <Link
                href={STUDIO_HREF.project}
                className="inline-flex h-11 items-center rounded-full border border-primary px-4 font-medium text-primary"
              >
                Fix a scene
              </Link>
              <button
                type="button"
                disabled
                className="h-11 cursor-not-allowed rounded-full border border-border bg-card px-4 font-medium text-muted-foreground"
              >
                Open timeline editor
              </button>
            </div>
            {downloaded ? (
              <p role="status" className="m-0 text-[13px] font-medium text-emerald-300">
                Download started (simulated) · why-sleep-matters-v1.mp4
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3.5">
              <span className="text-[13px] text-muted-foreground">
                Later: send this fixed version to Publish, or let Automations repeat it.
              </span>
              <Link
                href={STUDIO_HREF.publish}
                className="text-[13px] font-medium text-primary hover:text-primary/80"
              >
                See Publish
              </Link>
            </div>
            <button type="button" onClick={restart} className={cn(quietButton, "h-10 self-start px-4")}>
              Make another
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
