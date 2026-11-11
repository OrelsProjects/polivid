"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { btn, Card, Chip, SectionTitle, TONE, type Tone } from "./studio-ui";
import { STUDIO_HREF } from "./studio-links";

/* Port of design/studio-prototype/Batch.dc.html. */

type Gen = "none" | "rendering" | "ready" | "failed";

type Item = {
  title: string;
  shape: string;
  cost: number;
  approved: boolean;
  gen: Gen;
  version: number;
  passages: string[];
  script: string;
};

const INITIAL_ITEMS: Item[] = [
  {
    title: "Why newsletters die in month three",
    shape: "45s",
    cost: 90,
    approved: true,
    gen: "ready",
    version: 1,
    passages: ["Most newsletters die in month three. Not from lack of ideas, from lack of a system."],
    script:
      "Most newsletters do not die from a lack of ideas. They die in month three, when the system that should carry them does not exist. Here is the system that carried mine.",
  },
  {
    title: "The swipe file habit",
    shape: "30s",
    cost: 60,
    approved: true,
    gen: "failed",
    version: 0,
    passages: ["a swipe file"],
    script:
      "A swipe file is a folder of lines you wish you had written. Three steps: capture the line, note why it works, steal the structure when you are stuck.",
  },
  {
    title: "End every issue with one question",
    shape: "30s",
    cost: 60,
    approved: false,
    gen: "none",
    version: 0,
    passages: ["a rule that every issue ends with one question"],
    script:
      "Every issue ends with one question. Not a survey, one question. The replies become next issue, and the reader becomes a co-writer.",
  },
];

function badge(item: Item): { status: string; tone: Tone; thumb: string } {
  if (item.gen === "ready") return { status: `Ready · v${item.version}`, tone: "ready", thumb: "bg-sky-400/15" };
  if (item.gen === "rendering") return { status: "Rendering", tone: "rendering", thumb: "bg-border" };
  if (item.gen === "failed") return { status: "Render failed", tone: "failed", thumb: "bg-red-400/10" };
  if (item.approved) return { status: "Approved · not generated", tone: "primary", thumb: "bg-border" };
  return { status: "Awaiting approval", tone: "attention", thumb: "bg-border" };
}

const GEN_NOTE: Record<Gen, string> = {
  ready: "Done",
  rendering: "In progress (simulated)",
  failed: "Failed · credits refunded",
  none: "Not started",
};

/** Bordered pill link with no fill (the prototype's secondary `<a>`). */
const ghostLink = "inline-flex items-center rounded-full border border-border font-medium text-foreground/80";
const textLink = "text-primary hover:text-primary/80";
const cardTitle = "m-0 font-sans text-[13px] font-semibold tracking-normal";

export function BatchView() {
  const [selected, setSelected] = useState(2);
  const [sim, setSim] = useState("");
  const [items, setItems] = useState(INITIAL_ITEMS);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const update = (i: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((item, j) => (j === i ? { ...item, ...patch } : item)));

  const generate = (i: number) => {
    update(i, { gen: "rendering" });
    setSim("Simulated render · no model is called and no credits move");
    const timer = setTimeout(() => {
      timers.current.delete(timer);
      setItems((prev) =>
        prev.map((item, j) => (j === i ? { ...item, gen: "ready", version: (item.version || 0) + 1 } : item)),
      );
      setSim(`Video ${i + 1} rendered (simulated).`);
    }, 2200);
    timers.current.add(timer);
  };

  const ready = items.filter((item) => item.gen === "ready");
  const rendering = items.filter((item) => item.gen === "rendering");
  const failed = items.filter((item) => item.gen === "failed").length;
  const waiting = items.filter((item) => !item.approved).length;
  const parts: string[] = [];
  if (ready.length) parts.push(`${ready.length} ready`);
  if (rendering.length) parts.push(`${rendering.length} rendering`);
  if (failed) parts.push(`${failed} failed`);
  if (waiting) parts.push(`${waiting} awaiting approval`);
  const summary = `${parts.join(" · ")} · each video is approved, rendered and downloaded on its own`;
  const charged = ready.reduce((sum, item) => sum + item.cost, 0);
  const held = rendering.reduce((sum, item) => sum + item.cost, 0);
  const pending = items
    .filter((item) => item.gen !== "ready" && item.gen !== "rendering")
    .reduce((sum, item) => sum + item.cost, 0);

  const selIndex = items[selected] ? selected : 0;
  const sel = items[selIndex];
  const selBadge = badge(sel);

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Link href={STUDIO_HREF.projects} className={textLink}>
          Projects
        </Link>
        <span aria-hidden="true">/</span>
        <span>October newsletter → 3 shorts</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="primary">Batch · 3 videos</Chip>
            <span className="text-[12px] text-muted-foreground">
              Source:{" "}
              <Link href={STUDIO_HREF.sources} className={textLink}>
                Our October newsletter
              </Link>{" "}
              · shared settings: 9:16 · Motion graphics · Bold · Narrator
            </span>
          </div>
          <h1 className="m-0 font-heading text-[30px] leading-[1.15] font-semibold tracking-normal">
            October newsletter → 3 shorts
          </h1>
          <p className="m-0 text-[14px] text-muted-foreground">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={ready.length === 0}
            onClick={() => setSim(`Download started (simulated) · ${ready.length} ready video(s)`)}
            className={cn(btn.primary, "h-11 cursor-pointer px-5")}
          >
            Download {ready.length} ready
          </button>
          <Link href={STUDIO_HREF.sources} className={cn(ghostLink, "h-11 px-4")}>
            Change concepts
          </Link>
        </div>
      </header>

      {sim ? (
        <p role="status" className="m-0 text-[13px] font-medium text-amber-300">
          {sim}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Videos in this batch" className="flex max-w-[340px] flex-[1_1_260px] flex-col gap-2.5">
          <SectionTitle size={18}>Videos</SectionTitle>
          {items.map((item, i) => {
            const on = selected === i;
            const b = badge(item);
            return (
              <button
                key={item.title}
                type="button"
                aria-pressed={on}
                onClick={() => setSelected(i)}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-[14px] border-2 bg-card p-3 text-left text-foreground",
                  on ? "border-primary" : "border-border",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex h-[72px] w-11 flex-[0_0_44px] items-center justify-center rounded-[8px] text-[12px] font-semibold text-foreground/80",
                    b.thumb,
                  )}
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 flex-auto flex-col gap-1">
                  <span className="text-[14px] leading-[1.3] font-semibold">{item.title}</span>
                  <span className="text-[12px] text-muted-foreground">
                    {item.shape} · {item.cost} credits
                  </span>
                  <span className={cn("self-start rounded-full px-2 py-px text-[11px] font-semibold", TONE[b.tone])}>
                    {b.status}
                  </span>
                </span>
              </button>
            );
          })}
          <p className="m-0 mt-1 text-[12px] text-muted-foreground">
            Each video renders, fails and downloads on its own. One failure never hides the others.
          </p>
        </section>

        <Card aria-label="Selected video" className="min-w-0 flex-[999_1_400px] gap-3.5 px-[22px] py-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>
              {selIndex + 1} · {sel.title}
            </SectionTitle>
            <Chip tone={selBadge.tone}>{selBadge.status}</Chip>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-foreground/80">Source passages this video is built on</span>
            {sel.passages.map((text) => (
              <span key={text} className="rounded-[8px] bg-accent px-3 py-2 text-[13px] text-foreground/80">
                “{text}”
              </span>
            ))}
          </div>

          <label htmlFor="script" className="text-[13px] font-medium text-foreground/80">
            Script
          </label>
          <textarea
            id="script"
            rows={6}
            value={sel.script}
            onChange={(event) => update(selIndex, { script: event.target.value })}
            disabled={sel.approved}
            className={cn(
              "w-full resize-y rounded-[14px] border border-border px-3.5 py-3 text-[15px] text-foreground",
              sel.approved ? "bg-secondary" : "bg-muted",
            )}
          />
          <span className="text-[12px] text-muted-foreground">
            {sel.approved
              ? "Approved. This exact text goes into generation. Reopen to edit, which withdraws the approval."
              : "Edit freely. Nothing is generated until you approve."}
          </span>

          <div className="flex flex-wrap gap-5 border-t border-border pt-3.5">
            <dl className="m-0 grid flex-[1_1_220px] grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 text-[13px]">
              <dt className="text-muted-foreground">Estimated cost</dt>
              <dd className="m-0">
                {sel.cost} credits · {sel.shape}
              </dd>
              <dt className="text-muted-foreground">Approval</dt>
              <dd className="m-0">{sel.approved ? "Approved" : "Not yet"}</dd>
              <dt className="text-muted-foreground">Generation</dt>
              <dd className="m-0">{GEN_NOTE[sel.gen]}</dd>
              <dt className="text-muted-foreground">Output</dt>
              <dd className="m-0">{sel.gen === "ready" ? `v${sel.version} · MP4 ready` : "None yet"}</dd>
            </dl>
            <div className="flex flex-[1_1_220px] flex-col items-start gap-2">
              {!sel.approved ? (
                <button
                  type="button"
                  onClick={() => update(selIndex, { approved: true })}
                  className={cn(btn.primary, "h-11 cursor-pointer px-5")}
                >
                  Approve script
                </button>
              ) : null}
              {sel.approved && sel.gen === "none" ? (
                <>
                  <button
                    type="button"
                    onClick={() => generate(selIndex)}
                    className={cn(btn.primary, "h-11 cursor-pointer px-5")}
                  >
                    Generate · hold {sel.cost} credits
                  </button>
                  <button
                    type="button"
                    onClick={() => update(selIndex, { approved: false })}
                    className={cn(btn.quiet, "h-9 cursor-pointer px-3")}
                  >
                    Reopen script for edits
                  </button>
                </>
              ) : null}
              {sel.gen === "failed" ? (
                <>
                  <button
                    type="button"
                    onClick={() => generate(selIndex)}
                    className={cn(btn.primary, "h-11 cursor-pointer px-5")}
                  >
                    Retry · hold {sel.cost} credits
                  </button>
                  <Link href={STUDIO_HREF.recovery} className={cn(ghostLink, "h-9 px-3")}>
                    See what failed
                  </Link>
                </>
              ) : null}
              {sel.gen === "ready" ? (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setSim(`Download started (simulated) · video ${selIndex + 1} v${sel.version}.mp4`)
                    }
                    className={cn(btn.primary, "h-11 cursor-pointer px-5")}
                  >
                    Download MP4 · v{sel.version}
                  </button>
                  <Link href={STUDIO_HREF.project} className={cn(ghostLink, "h-9 px-3")}>
                    Edit scenes
                  </Link>
                </>
              ) : null}
              {sel.gen === "rendering" ? (
                <span className="text-[13px] font-medium text-sky-300">
                  Rendering (simulated) · you can leave this page
                </span>
              ) : null}
            </div>
          </div>
        </Card>

        <aside aria-label="Batch settings" className="flex max-w-[320px] flex-[1_1_240px] flex-col gap-3.5">
          <Card className="gap-2.5 px-[18px] py-4">
            <h2 className={cardTitle}>Shared creative settings</h2>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
              <dt className="text-muted-foreground">Format</dt>
              <dd className="m-0">9:16 vertical</dd>
              <dt className="text-muted-foreground">Presentation</dt>
              <dd className="m-0">Motion graphics</dd>
              <dt className="text-muted-foreground">Style</dt>
              <dd className="m-0">Bold</dd>
              <dt className="text-muted-foreground">Voice</dt>
              <dd className="m-0">Narrator</dd>
            </dl>
            <button type="button" className={cn(btn.quiet, "h-[34px] cursor-pointer self-start px-3")}>
              Change for unrendered videos
            </button>
            <p className="m-0 text-[12px] text-muted-foreground">Rendered videos keep the settings they were made with.</p>
          </Card>
          <Card className="gap-2 px-[18px] py-4">
            <h2 className={cardTitle}>Credits on this batch</h2>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[13px]">
              <dt className="text-muted-foreground">Charged</dt>
              <dd className="m-0">{charged} credits</dd>
              <dt className="text-muted-foreground">Held</dt>
              <dd className="m-0">{held} credits</dd>
              <dt className="text-muted-foreground">Not started</dt>
              <dd className="m-0">{pending} credits estimated</dd>
            </dl>
            <p className="m-0 text-[12px] text-muted-foreground">
              Approved scripts go into generation unchanged. Reopening a script withdraws its approval.
            </p>
          </Card>
          <Card className="gap-2 px-[18px] py-4">
            <h2 className={cardTitle}>Later</h2>
            <p className="m-0 text-[13px] text-foreground/80">
              Ready videos can be sent to{" "}
              <Link href={STUDIO_HREF.publish} className={textLink}>
                Publish
              </Link>{" "}
              as fixed versions. This batch shape is also what{" "}
              <Link href={STUDIO_HREF.automations} className={textLink}>
                Automations
              </Link>{" "}
              will repeat per new post.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
