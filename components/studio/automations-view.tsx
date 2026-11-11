"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { btn, Card, PageHeader, SectionTitle, TONE } from "./studio-ui";
import { STUDIO_HREF } from "./studio-links";

const SERIES: { title: string; meta: string; trigger: string; creative: string }[] = [
  {
    title: "New post on The Indiepreneur → 3 shorts",
    meta: "Per saved source · review first · cap 200 per run",
    trigger: "Each new source saved with the tag “Indiepreneur”. Up to three concepts per post, never padded.",
    creative: "9:16 · Motion graphics · Bold · Narrator",
  },
  {
    title: "Weekly tip from saved sources",
    meta: "Mondays · review first · draft only",
    trigger: "Every Monday 09:00 Asia/Jerusalem, one concept from the newest unused source.",
    creative: "9:16 · Illustration · Minimal · Orel (recorded)",
  },
];

const cell = "border-b border-secondary p-2";
const head = "border-b border-border px-2 py-1.5 font-medium";

export function AutomationsView() {
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(true);
  const [approval, setApproval] = useState<"review" | "auto">("review");
  const [permission, setPermission] = useState(false);
  const [capRun, setCapRun] = useState("200");
  const [capMonth, setCapMonth] = useState("1500");

  const series = SERIES.map((x, i) => ({
    ...x,
    on: selected === i,
    status: i === 0 ? (paused ? "Paused" : "Active") : "Draft",
    tone: i === 0 ? (paused ? TONE.attention : TONE.ready) : TONE.neutral,
  }));
  const sel = series[selected];
  const autoGen = approval === "auto";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Automations"
        lede="Recurring series built from the same create and batch steps. Review first by default; spending is capped per run."
        aside={
          <button type="button" disabled className={cn(btn.primary, "h-11 px-5")}>
            New series
          </button>
        }
      />

      <div
        role="note"
        className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[13px] text-foreground/80"
      >
        <span className="font-semibold text-amber-300">Design view · later phase.</span>
        <span>
          No series runs. The settings below show the controls a series will need: an explicit generation permission, a
          spending cap, review-first, skip and deduplication, pause, and a run history.
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Series" className="flex max-w-[320px] flex-[1_1_240px] flex-col gap-2.5">
          <SectionTitle size={18}>Series</SectionTitle>
          {series.map((x, i) => (
            <button
              key={x.title}
              type="button"
              aria-pressed={x.on}
              onClick={() => setSelected(i)}
              className={cn(
                "flex cursor-pointer flex-col gap-1.5 rounded-[16px] border-2 bg-card px-4 py-3.5 text-left text-foreground",
                x.on ? "border-primary" : "border-border",
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-[14px] leading-[1.3] font-semibold">{x.title}</span>
                <span className={cn("rounded-full px-2 py-px text-[11px] font-semibold whitespace-nowrap", x.tone)}>
                  {x.status}
                </span>
              </span>
              <span className="text-[12px] text-muted-foreground">{x.meta}</span>
            </button>
          ))}
        </section>

        <section aria-label="Series settings" className="flex min-w-0 flex-[999_1_400px] flex-col gap-3.5">
          <Card as="div" className="gap-4 px-[22px] py-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle>{sel.title}</SectionTitle>
              <button
                type="button"
                onClick={() => setPaused(!paused)}
                className={cn(btn.quiet, "h-9 cursor-pointer px-3.5")}
              >
                {paused ? "Resume (design only)" : "Pause"}
              </button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">Trigger</span>
                <span className="text-[13px] text-foreground/80">{sel.trigger}</span>
                <span className="text-[12px] text-muted-foreground">
                  Sources come from the Sources page. No feed or inbox is connected in this phase.
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">Creative settings</span>
                <span className="text-[13px] text-foreground/80">{sel.creative}</span>
                <span className="text-[12px] text-muted-foreground">
                  Same settings object a batch uses. Change it once, every future run follows.
                </span>
              </div>
            </div>

            <fieldset className="m-0 flex flex-col gap-2.5 rounded-[14px] border border-border px-4 py-3.5">
              <legend className="px-1.5 text-[13px] font-semibold">Approval</legend>
              <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
                <input
                  type="radio"
                  name="approval"
                  checked={approval === "review"}
                  onChange={() => {
                    setApproval("review");
                    setPermission(false);
                  }}
                  className="mt-[3px] accent-primary"
                />
                <span>
                  <strong className="font-semibold">Review first.</strong> Each run drafts scripts and stops. Nothing
                  renders until you approve each video.
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 text-[14px]">
                <input
                  type="radio"
                  name="approval"
                  checked={autoGen}
                  onChange={() => setApproval("auto")}
                  className="mt-[3px] accent-primary"
                />
                <span>
                  <strong className="font-semibold">Generate without review.</strong> Renders inside the cap. Needs
                  the explicit permission below.
                </span>
              </label>
              {autoGen && (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={permission}
                    onChange={() => setPermission(!permission)}
                    className="mt-0.5 accent-primary"
                  />
                  <span>
                    I allow this series to spend credits on renders without my review, up to the cap. Delivery still
                    never happens automatically in this phase.
                  </span>
                </label>
              )}
            </fieldset>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cap-run" className="text-[13px] font-semibold">
                  Cap per run
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="cap-run"
                    type="number"
                    value={capRun}
                    onChange={(e) => setCapRun(e.target.value)}
                    className="h-10 w-[110px] rounded-[12px] border border-border px-3"
                  />
                  <span className="text-[13px] text-muted-foreground">credits</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cap-month" className="text-[13px] font-semibold">
                  Cap per month
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="cap-month"
                    type="number"
                    value={capMonth}
                    onChange={(e) => setCapMonth(e.target.value)}
                    className="h-10 w-[110px] rounded-[12px] border border-border px-3"
                  />
                  <span className="text-[13px] text-muted-foreground">credits</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">Skip when</span>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" defaultChecked disabled className="m-[3px_3px_3px_4px] accent-primary" />
                  Same source already ran
                </label>
                <label className="flex items-center gap-2 text-[13px]">
                  <input type="checkbox" defaultChecked disabled className="m-[3px_3px_3px_4px] accent-primary" />
                  Source is under 300 words
                </label>
              </div>
            </div>
            <p className="m-0 text-[12px] text-muted-foreground">
              A run that would exceed a cap stops before rendering and shows up in history as stopped, with the drafts
              kept.
            </p>
          </Card>

          <Card as="div" className="gap-3 px-[22px] py-5">
            <h2 className="m-0 font-sans text-[13px] font-semibold tracking-normal">Run history · sample</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className={head}>When</th>
                    <th className={head}>Source</th>
                    <th className={head}>Result</th>
                    <th className={head}>Credits</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={cell}>Oct 16</td>
                    <td className={cell}>Our October newsletter</td>
                    <td className={cell}>
                      <Link href={STUDIO_HREF.batch} className="text-primary no-underline hover:text-primary/80">
                        3 drafts · 1 awaiting review
                      </Link>
                    </td>
                    <td className={cell}>150 held</td>
                  </tr>
                  <tr>
                    <td className={cell}>Oct 12</td>
                    <td className={cell}>Why I left corporate</td>
                    <td className={cell}>2 drafts · both rendered</td>
                    <td className={cell}>140 charged</td>
                  </tr>
                  <tr>
                    <td className={cell}>Oct 9</td>
                    <td className={cell}>Quick note about pricing</td>
                    <td className={cell}>
                      <span className="text-muted-foreground">Skipped · under 300 words</span>
                    </td>
                    <td className={cell}>0</td>
                  </tr>
                  <tr>
                    <td className="p-2">Oct 2</td>
                    <td className="p-2">September issue</td>
                    <td className="p-2">
                      <span className="text-amber-300">Stopped · monthly cap reached, drafts kept</span>
                    </td>
                    <td className="p-2">0</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
