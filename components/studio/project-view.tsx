"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card, Chip, SectionTitle, toggle, TONE, TONE_TEXT, type Tone } from "./studio-ui";
import { useStudioPlan } from "./studio-frame";
import { STUDIO_HREF } from "./studio-links";

/*
 * Port of design/studio-prototype/Project.dc.html (variant "ready") and
 * ProjectRecovery.dc.html (variant "recovery"). Both are the same project
 * editor, so the breadcrumb, header, output card and details card are shared.
 */

export function ProjectView({ variant }: { variant: "ready" | "recovery" }) {
  return variant === "recovery" ? <RecoveryProject /> : <ReadyProject />;
}

/* ---------- Shared layout ---------- */

const BTN_PRIMARY = "h-10 cursor-pointer rounded-full border-0 bg-[#5B2EE6] px-4 font-medium text-white";
const BTN_QUIET = "h-10 cursor-pointer rounded-full border border-[#E4E4EC] bg-white px-4 font-medium text-[#3F3D4F]";
const BTN_QUIET_DISABLED =
  "h-10 cursor-not-allowed rounded-full border border-[#E4E4EC] bg-white px-4 font-medium text-[#8A8899]";
const FIELD_LABEL = "text-[13px] font-medium text-[#3F3D4F]";

function Breadcrumb({ title }: { title: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-[#6B6A7B]">
      <Link href={STUDIO_HREF.projects} className="text-[#4A23C9] hover:text-[#3A1AA6]">
        Projects
      </Link>
      <span aria-hidden="true">/</span>
      <span>{title}</span>
    </nav>
  );
}

/** Status chip + lineage, title, spec line; actions on the right end with the disabled timeline editor. */
function ProjectHeader({
  tone,
  status,
  lineage,
  title,
  specs,
  children,
}: {
  tone: Tone;
  status: string;
  lineage: ReactNode;
  title: string;
  specs: string;
  children: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={tone}>{status}</Chip>
          <span className="text-[12px] text-[#6B6A7B]">{lineage}</span>
        </div>
        <h1 className="m-0 font-heading text-[30px] leading-[1.15] font-semibold tracking-normal">{title}</h1>
        <p className="m-0 text-[14px] text-[#6B6A7B]">{specs}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {children}
        <button
          type="button"
          disabled
          className="h-11 cursor-not-allowed rounded-full border border-[#E4E4EC] bg-white px-4 font-medium text-[#8A8899]"
        >
          Open timeline editor
        </button>
      </div>
    </header>
  );
}

/** Right rail: output preview + versions card, then a details card. */
function OutputAside({ children }: { children: ReactNode }) {
  return (
    <aside aria-label="Output and details" className="flex max-w-[340px] flex-[1_1_260px] flex-col gap-3.5">
      {children}
    </aside>
  );
}

function OutputCard({ preview, children }: { preview: ReactNode; children: ReactNode }) {
  return (
    <Card className="gap-3 p-3.5">
      {preview}
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Versions</span>
        {children}
      </div>
    </Card>
  );
}

function VersionRow({
  label,
  note,
  tone,
  pending = false,
}: {
  label: string;
  note: string;
  tone: Tone;
  pending?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-[10px] border px-2.5 py-2 text-[13px]",
        pending ? "border-dashed border-[#E3C78A] bg-[#FFF8EA]" : "border-[#E4E4EC] bg-[#FAFAFC]",
      )}
    >
      <span>{label}</span>
      <span className={cn("font-medium", TONE_TEXT[tone])}>{note}</span>
    </div>
  );
}

function InfoCard({ title, rows, children }: { title: string; rows: [string, ReactNode][]; children?: ReactNode }) {
  return (
    <Card className="gap-2 px-[18px] py-4">
      <h2 className="m-0 font-sans text-[13px] font-semibold tracking-normal">{title}</h2>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
        {rows.map(([term, value]) => (
          <Fragment key={term}>
            <dt className="text-[#6B6A7B]">{term}</dt>
            <dd className="m-0">{value}</dd>
          </Fragment>
        ))}
      </dl>
      {children}
    </Card>
  );
}

/* ---------- Project.dc.html: ready output (v1) + re-render on edit ---------- */

type ReadyScene = {
  title: string;
  text: string;
  onscreen: string;
  visual: string;
  seconds: number;
  changed: boolean;
};

const READY_SCENES: ReadyScene[] = [
  {
    title: "Hook",
    text: "Every night your brain decides what to keep. Most of today is already on the list to delete.",
    onscreen: "Tonight decides",
    visual: "Big line, slow push-in",
    seconds: 5,
    changed: false,
  },
  {
    title: "Mechanism",
    text: "Sleep replays the day in fast forward and files the parts you used twice.",
    onscreen: "Replay → keep",
    visual: "Two-step diagram",
    seconds: 6,
    changed: false,
  },
  {
    title: "Close",
    text: "Click save. Then sleep.",
    onscreen: "Click. Then sleep.",
    visual: "Closing card",
    seconds: 4,
    changed: false,
  },
];

const VOICES = [
  { label: "Narrator", on: true },
  { label: "Orel · recorded", on: false },
  { label: "Captions only", on: false },
];

function ReadyProject() {
  const [selected, setSelected] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [scenes, setScenes] = useState(READY_SCENES);

  const changed = scenes.filter((sc) => sc.changed);
  const changedCount = changed.length;
  const rerenderCost = changed.reduce((sum, sc) => sum + sc.seconds * 4, 0);
  const current = scenes[selected];

  const edit = (patch: Partial<Pick<ReadyScene, "text" | "onscreen">>) =>
    setScenes((list) => list.map((sc, i) => (i === selected ? { ...sc, ...patch, changed: true } : sc)));
  const rerender = () => setScenes((list) => list.map((sc) => ({ ...sc, changed: false })));

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb title="Click, Then Sleep" />

      <ProjectHeader
        tone="ready"
        status="Ready · v1"
        lineage="Started from an idea · rendered 2 h ago · 60 credits charged (sample)"
        title="Click, Then Sleep"
        specs="9:16 · 15s · Motion graphics · Bold · Narrator voice"
      >
        <button
          type="button"
          onClick={() => setDownloaded(true)}
          className="h-11 cursor-pointer rounded-full border-0 bg-[#5B2EE6] px-5 font-medium text-white"
        >
          Download MP4
        </button>
        {changedCount > 0 ? (
          <button
            type="button"
            onClick={rerender}
            className="h-11 cursor-pointer rounded-full border border-[#5B2EE6] bg-white px-4 font-medium text-[#4A23C9]"
          >
            Re-render {changedCount} changed · {rerenderCost} credits
          </button>
        ) : null}
      </ProjectHeader>

      {downloaded ? (
        <p role="status" className="m-0 rounded-[12px] bg-[#E3F5EA] px-3.5 py-2.5 text-[13px] font-medium text-[#157347]">
          Download started (simulated) · click-then-sleep-v1.mp4 · the MP4 is the fixed v1 output, not the live draft.
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Scenes" className="flex max-w-[320px] flex-[1_1_240px] flex-col gap-2.5">
          <SectionTitle size={18}>Scenes</SectionTitle>
          {scenes.map((sc, i) => {
            const on = selected === i;
            return (
              <button
                key={sc.title}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(i)}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-[14px] border-2 bg-white p-3 text-left text-[#141321]",
                  on ? "border-[#5B2EE6]" : "border-[#E4E4EC]",
                )}
              >
                <span
                  aria-hidden="true"
                  className="inline-flex size-12 flex-[0_0_48px] items-center justify-center rounded-[10px] bg-[#E9E8F1] font-semibold text-[#3F3D4F]"
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-auto flex-col gap-0.5">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-[14px] font-semibold">{sc.title}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-px text-[11px] font-semibold",
                        TONE[sc.changed ? "attention" : "ready"],
                      )}
                    >
                      {sc.changed ? "Changed" : "Rendered"}
                    </span>
                  </span>
                  <span className="truncate text-[12px] text-[#6B6A7B]">{sc.text}</span>
                  <span className="text-[12px] text-[#6B6A7B]">{sc.seconds}s</span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            className="h-10 cursor-pointer rounded-[12px] border border-dashed border-[#C9C8D6] bg-transparent font-medium text-[#3F3D4F]"
          >
            + Add a scene
          </button>
        </section>

        <Card aria-label="Selected scene" className="min-w-0 flex-[999_1_380px] gap-3.5 px-[22px] py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionTitle size={18}>
              Scene {selected + 1} · {current.title}
            </SectionTitle>
            <span className="text-[12px] text-[#6B6A7B]">Editing marks the scene for re-render. v1 stays downloadable.</span>
          </div>
          <label htmlFor="narration" className={FIELD_LABEL}>
            Narration
          </label>
          <textarea
            id="narration"
            rows={4}
            value={current.text}
            onChange={(e) => edit({ text: e.target.value })}
            className="w-full resize-y rounded-[14px] border border-[#E4E4EC] bg-[#FAFAFC] px-3.5 py-3 text-[15px] text-[#141321]"
          />
          <label htmlFor="onscreen" className={FIELD_LABEL}>
            On-screen text
          </label>
          <input
            id="onscreen"
            type="text"
            value={current.onscreen}
            onChange={(e) => edit({ onscreen: e.target.value })}
            className="h-[42px] rounded-[12px] border border-[#E4E4EC] bg-[#FAFAFC] px-3.5 text-[15px] text-[#141321]"
          />
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>Visual</span>
            <div className="flex items-center gap-3 rounded-[14px] border border-[#E4E4EC] p-3">
              <span
                aria-hidden="true"
                className="inline-flex size-[72px] flex-[0_0_72px] items-center justify-center rounded-[10px] bg-[#141321] font-heading text-[12px] font-bold text-[#F5B342]"
              >
                BOLD
              </span>
              <div className="flex flex-col gap-1 text-[13px]">
                <span className="font-medium">{current.visual}</span>
                <span className="text-[#6B6A7B]">Motion graphics · Bold</span>
                <button
                  type="button"
                  className="h-[30px] cursor-pointer self-start rounded-full border border-[#E4E4EC] bg-white px-2.5 text-[12px] font-medium text-[#3F3D4F]"
                >
                  Change visual note
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>Voice</span>
            <div className="flex flex-wrap gap-2">
              {VOICES.map((voice) => (
                <button
                  key={voice.label}
                  type="button"
                  aria-pressed={voice.on}
                  className={cn("h-9 cursor-pointer rounded-full border px-3.5 font-medium", toggle(voice.on))}
                >
                  {voice.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        <OutputAside>
          <OutputCard
            preview={
              <div
                role="img"
                aria-label="Finished video placeholder"
                className="flex aspect-[9/16] max-h-[360px] flex-col justify-between rounded-[12px] bg-[#141321] p-3.5 text-[12px] text-white"
              >
                <span className="text-[#C9C8D6]">v1 · 9:16 · 15s</span>
                <span className="font-heading text-[24px] leading-[1.1] font-bold text-[#F5B342]">Click. Then sleep.</span>
              </div>
            }
          >
            <VersionRow label="v1 · 2 h ago" note="Current" tone="ready" />
            {changedCount > 0 ? (
              <VersionRow label="v2 · not rendered" note={`${changedCount} scene changed`} tone="attention" pending />
            ) : null}
          </OutputCard>
          <InfoCard
            title="Details"
            rows={[
              ["Input", "Idea"],
              ["Presentation", "Motion graphics"],
              ["Engine", "Scene plan → editor render"],
              ["Charged", "60 credits · v1"],
              ["Publish", "Not scheduled"],
            ]}
          />
        </OutputAside>
      </div>
    </div>
  );
}

/* ---------- ProjectRecovery.dc.html: same project with failures + recovery paths ---------- */

type Scene2 = "failed" | "rendering" | "rendered";
type ExportState = "none" | "failed" | "ready" | "partial";
type SceneStatus = "rendered" | "rendering" | "dropped" | "failed";

const SCENE_STATUS: Record<SceneStatus, { label: string; tone: Tone; thumb: string }> = {
  rendered: { label: "Rendered", tone: "ready", thumb: "bg-[#DDEBFF]" },
  rendering: { label: "Rendering (simulated)", tone: "rendering", thumb: "bg-[#E9E8F1]" },
  dropped: { label: "Left out of export", tone: "neutral", thumb: "bg-[#E9E8F1]" },
  failed: { label: "Failed · refunded", tone: "failed", thumb: "bg-[#FDE8EA]" },
};

const RECOVERY_SCENES = [
  { n: 1, title: "Hook", text: "You forget forty percent of what you learned today unless you sleep on it." },
  { n: 2, title: "Replay", text: "While you are out cold, the hippocampus replays the day and files the keepers." },
  { n: 3, title: "Takeaway", text: "Study, then sleep. One night beats one more hour of cramming." },
];

/** White list card (16px radius) with a coloured hairline for each recovery panel. */
function Notice({
  label,
  border,
  className,
  children,
}: {
  label: string;
  border: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article aria-label={label} className={cn("flex flex-col rounded-[16px] border bg-white px-[18px] py-4", border, className)}>
      {children}
    </article>
  );
}

function RecoveryProject() {
  const [scene2, setScene2] = useState<Scene2>("failed");
  const [exportState, setExportState] = useState<ExportState>("none");
  const [balance, setBalance] = useState(12);
  const [lowCredits, setLowCredits] = useState(false);
  const [sim, setSim] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useStudioPlan({ name: "Starter plan", balance, low: true });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const startScene2 = (cost: number) => {
    setScene2("rendering");
    setLowCredits(false);
    setBalance((b) => b - cost);
    setSim("Simulated render of scene 2 · no model is called");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setScene2("rendered");
      setExportState("failed");
      setSim("Scene 2 rendered (simulated). The export step then failed, to show that recovery path.");
    }, 1800);
  };

  const sceneFailed = scene2 === "failed";
  const renderedCount = scene2 === "rendered" ? 3 : 2;
  const exportFailed = exportState === "failed";
  const allGood = scene2 === "rendered" && exportState === "ready";
  const partial = exportState === "partial";
  const noOutput = !(allGood || partial);

  const head: { status: string; tone: Tone } = allGood
    ? { status: "Ready · v1", tone: "ready" }
    : partial
      ? { status: "Partial export · v1 (2 scenes)", tone: "attention" }
      : exportFailed
        ? { status: "Export failed", tone: "failed" }
        : scene2 === "rendering"
          ? { status: "Rendering scene 2", tone: "rendering" }
          : { status: "1 scene failed", tone: "failed" };

  const dlLabel = allGood ? "Download MP4" : partial ? "Download partial MP4" : "No MP4 yet";
  const outputNote = allGood
    ? "v1 · 30s · ready"
    : partial
      ? "v1 · 20s · scenes 1 and 3"
      : exportFailed
        ? "Scenes rendered · MP4 not built"
        : "No output until every scene renders or you export without scene 2";

  const retry = () => {
    if (balance < 20) {
      setLowCredits(true);
      setSim("");
    } else startScene2(20);
  };
  const exportPartial = () => {
    setExportState("partial");
    setLowCredits(false);
    setSim("Exported scenes 1 and 3 (simulated). Scene 2 stays retryable.");
  };
  const topUp = () => {
    setBalance(112);
    setLowCredits(false);
    setSim("Credits added (simulated). Retry scene 2 is now possible.");
  };
  const retryExport = () => {
    setExportState("ready");
    setSim("Export rebuilt (simulated) · v1 ready to download.");
  };

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb title="Why sleep matters for memory" />

      <ProjectHeader
        tone={head.tone}
        status={head.status}
        lineage={`Started from an idea · ${renderedCount} of 3 scenes rendered · 40 credits held, 20 refunded (sample)`}
        title="Why sleep matters for memory"
        specs="9:16 · 30s · Generated scenes · Rounded 3D · Narrator voice"
      >
        <button
          type="button"
          disabled={noOutput}
          onClick={() => setSim("Download started (simulated).")}
          className={cn(
            "h-11 cursor-pointer rounded-full border-0 px-5 font-medium text-white",
            noOutput ? "bg-[#B9B4D6]" : "bg-[#5B2EE6]",
          )}
        >
          {dlLabel}
        </button>
      </ProjectHeader>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="What needs attention" className="flex min-w-0 flex-[999_1_420px] flex-col gap-3">
          <SectionTitle size={18}>What needs attention</SectionTitle>

          {sceneFailed ? (
            <Notice label="Scene 2 failed" border="border-[#F3B8C0]" className="gap-2.5">
              <div className="flex items-start gap-2.5">
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#C2263A"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 flex-[0_0_20px]"
                >
                  <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" />
                </svg>
                <div className="flex flex-col gap-1">
                  <h3 className="m-0 text-[15px] font-semibold">Scene 2 did not render</h3>
                  <p className="m-0 text-[13px] text-[#3F3D4F]">
                    The model refused the combination of a reference picture and a storyboard frame in one request.
                    Scenes 1 and 3 are fine and kept. The 20 credits for this scene were refunded.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={retry} className={BTN_PRIMARY}>
                  Retry scene 2 · 20 credits
                </button>
                <button type="button" onClick={retry} className={BTN_QUIET}>
                  Drop the reference picture and retry
                </button>
                <button type="button" onClick={exportPartial} className={BTN_QUIET}>
                  Export without scene 2
                </button>
              </div>
            </Notice>
          ) : null}

          {lowCredits ? (
            <Notice label="Not enough credits" border="border-[#E3C78A]" className="gap-2.5">
              <div className="flex flex-col gap-1">
                <h3 className="m-0 text-[15px] font-semibold">Retrying needs 20 credits. You have {balance}.</h3>
                <p className="m-0 text-[13px] text-[#3F3D4F]">
                  Nothing was charged. Your rendered scenes and the script are safe. Choose a cheaper way to finish, or
                  top up.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={topUp} className={BTN_PRIMARY}>
                  Buy credits (sample)
                </button>
                <button type="button" onClick={() => startScene2(10)} className={BTN_QUIET}>
                  Shorten scene 2 to 5s · 10 credits
                </button>
                <button type="button" onClick={() => setLowCredits(false)} className={BTN_QUIET}>
                  Not now
                </button>
              </div>
            </Notice>
          ) : null}

          {exportFailed ? (
            <Notice label="Export failed" border="border-[#F3B8C0]" className="gap-2.5">
              <div className="flex flex-col gap-1">
                <h3 className="m-0 text-[15px] font-semibold">The MP4 export failed after rendering</h3>
                <p className="m-0 text-[13px] text-[#3F3D4F]">
                  Stitching the scenes timed out. Every rendered scene is kept, so retrying the export costs nothing.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={retryExport} className={BTN_PRIMARY}>
                  Retry export · free
                </button>
                <button type="button" disabled className={BTN_QUIET_DISABLED}>
                  Download scenes separately
                </button>
              </div>
            </Notice>
          ) : null}

          {allGood ? (
            <Notice label="Resolved" border="border-[#B8E0C6]" className="gap-1">
              <h3 className="m-0 text-[15px] font-semibold text-[#157347]">Nothing left to fix</h3>
              <p className="m-0 text-[13px] text-[#3F3D4F]">All three scenes rendered and the MP4 is ready. (Simulated.)</p>
            </Notice>
          ) : null}

          {sim ? (
            <p role="status" className="m-0 text-[13px] font-medium text-[#9A5B00]">
              {sim}
            </p>
          ) : null}

          <SectionTitle size={18} className="mt-2">
            Scenes
          </SectionTitle>
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {RECOVERY_SCENES.map((sc) => {
              const st = SCENE_STATUS[sc.n === 2 ? (partial ? "dropped" : scene2) : "rendered"];
              return (
                <li
                  key={sc.n}
                  className="flex items-center gap-3 rounded-[14px] border border-[#E4E4EC] bg-white p-3"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "inline-flex size-12 flex-[0_0_48px] items-center justify-center rounded-[10px] font-semibold text-[#3F3D4F]",
                      st.thumb,
                    )}
                  >
                    {sc.n}
                  </span>
                  <span className="flex min-w-0 flex-auto flex-col gap-0.5">
                    <span className="text-[14px] font-semibold">{sc.title}</span>
                    <span className="truncate text-[12px] text-[#6B6A7B]">{sc.text}</span>
                  </span>
                  <Chip tone={st.tone} className="whitespace-nowrap">
                    {st.label}
                  </Chip>
                </li>
              );
            })}
          </ol>
        </section>

        <OutputAside>
          <OutputCard
            preview={
              <div
                role="img"
                aria-label="Output placeholder"
                className="flex aspect-[9/16] max-h-[340px] items-center justify-center rounded-[12px] bg-[#E9E8F1] p-4 text-center text-[13px] text-[#6B6A7B]"
              >
                {outputNote}
              </div>
            }
          >
            <VersionRow label="v1" note={noOutput ? "Not built" : "Current"} tone={noOutput ? "attention" : "ready"} />
          </OutputCard>
          <InfoCard
            title="Credits on this project"
            rows={[
              ["Held at start", "60"],
              ["Charged", "40 · scenes 1 and 3"],
              ["Refunded", "20 · scene 2"],
              ["Balance", `${balance} (sample)`],
            ]}
          >
            <p className="m-0 text-[12px] text-[#6B6A7B]">
              Render status and publish status are separate. Nothing here is scheduled.
            </p>
          </InfoCard>
        </OutputAside>
      </div>
    </div>
  );
}
