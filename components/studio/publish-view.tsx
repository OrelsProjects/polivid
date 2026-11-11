"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { btn, Card, PageHeader, SectionTitle } from "./studio-ui";

export type PublishItem = { title: string; meta: string; version: string; href: string };

const DESTINATIONS = ["Shorts", "Reels", "TikTok", "LinkedIn"];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DELIVERY: [string, string][] = [
  ["Queued", "waiting for its time"],
  ["Delivered", "posted, link kept"],
  ["Delivery failed", "retry, media untouched"],
];

export function PublishView({ media }: { media: PublishItem[] }) {
  const [selected, setSelected] = useState(0);
  const [sim, setSim] = useState("");

  const sel = media[selected];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Publish"
        lede="Finished versions go out from here. A scheduled post always points at one fixed version, never at the draft."
      />

      <div
        role="note"
        className="flex flex-wrap items-center gap-2.5 rounded-[14px] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-[13px] text-foreground/80"
      >
        <span className="font-semibold text-amber-300">Design view · later phase.</span>
        <span>
          No account is connected, no scheduling backend exists, and nothing here delivers anything. Controls that would
          need an integration are disabled.
        </span>
      </div>

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Finished versions" className="flex max-w-[320px] flex-[1_1_240px] flex-col gap-2.5">
          <SectionTitle size={18}>Finished versions</SectionTitle>
          {media.map((m, i) => {
            const on = selected === i;
            return (
              <button
                key={m.title}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setSelected(i);
                  setSim("");
                }}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-[14px] border-2 bg-card p-2.5 text-left text-foreground",
                  on ? "border-primary" : "border-border",
                )}
              >
                <span aria-hidden="true" className="h-[72px] w-11 flex-[0_0_44px] rounded-[8px] bg-sky-400/15" />
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="text-[14px] leading-[1.3] font-semibold">{m.title}</span>
                  <span className="text-[12px] text-muted-foreground">{m.meta}</span>
                  <span className="text-[12px] font-medium text-emerald-300">Render: ready · {m.version}</span>
                </span>
              </button>
            );
          })}
          <p className="mt-1 mb-0 text-[12px] text-muted-foreground">
            Only rendered versions appear here. Drafts and failed renders stay in Projects.
          </p>
        </section>

        {sel ? <Card aria-label="Composer" className="min-w-0 flex-[999_1_380px] gap-3.5 px-[22px] py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionTitle>{sel.title}</SectionTitle>
            <span className="text-[12px] text-muted-foreground">{sel.version} · fixed media version</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <div
              role="img"
              aria-label="Post preview placeholder"
              className="flex aspect-[9/16] w-40 items-end rounded-[12px] bg-foreground p-2.5 text-[12px] text-input"
            >
              {sel.version} · {sel.meta}
            </div>
            <div className="flex min-w-0 flex-[1_1_240px] flex-col gap-3">
              <label htmlFor="caption" className="text-[13px] font-medium text-foreground/80">
                Caption
              </label>
              <textarea
                id="caption"
                rows={4}
                placeholder="Write the post text. Hashtags and a link can differ per destination later."
                className="w-full resize-y rounded-[12px] border border-border bg-muted px-3.5 py-3 text-[14px] text-foreground"
              />
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-foreground/80">Destinations</span>
                <div className="flex flex-wrap gap-2">
                  {DESTINATIONS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled
                      className="h-9 cursor-not-allowed rounded-full border border-dashed border-input bg-card px-3.5 font-medium text-muted-foreground"
                    >
                      {name} · not connected
                    </button>
                  ))}
                </div>
                <span className="text-[12px] text-muted-foreground">
                  Connections live under Workspace once an integration route is chosen.
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3.5">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="when" className="text-[13px] font-medium text-foreground/80">
                When · Asia/Jerusalem
              </label>
              <input
                id="when"
                type="datetime-local"
                disabled
                className="h-10 rounded-[12px] border border-border bg-secondary px-3 text-muted-foreground"
              />
            </div>
            <button type="button" disabled className={cn(btn.primary, "h-11 px-5")}>
              Add to queue
            </button>
            <a href={sel.href} className={cn(btn.outline, "inline-flex h-11 items-center px-4")}>
              Download this version
            </a>
          </div>
          {sim && (
            <p role="status" className="m-0 text-[13px] font-medium text-emerald-300">
              {sim}
            </p>
          )}
        </Card> : (
          <p className="m-0 text-[14px] text-muted-foreground">No finished video yet. Render one in Projects, then it shows up here.</p>
        )}

        <aside aria-label="Queue and delivery" className="flex max-w-[340px] flex-[1_1_260px] flex-col gap-3.5">
          <Card className="gap-2.5 px-[18px] py-4">
            <h2 className="m-0 font-sans text-[13px] font-semibold tracking-normal">This week</h2>
            <div className="grid grid-cols-7 gap-1 text-center text-[12px]">
              {DAYS.map((day) => (
                <span key={day} className="text-muted-foreground">
                  {day}
                </span>
              ))}
              <span className="flex h-11 items-center justify-center rounded-[8px] bg-accent font-semibold text-primary">
                18
              </span>
              {[19, 20, 21, 22, 23, 24].map((date) => (
                <span key={date} className="h-11 rounded-[8px] border border-border bg-muted">
                  {date}
                </span>
              ))}
            </div>
            <p className="m-0 text-[12px] text-muted-foreground">
              Queue is empty. Nothing can be scheduled until an integration exists.
            </p>
          </Card>
          <Card className="gap-2.5 px-[18px] py-4">
            <h2 className="m-0 font-sans text-[13px] font-semibold tracking-normal">
              Delivery status · how it will read
            </h2>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
              {DELIVERY.map(([state, note]) => (
                <li key={state} className="flex justify-between gap-2">
                  <span>{state}</span>
                  <span className="text-muted-foreground">{note}</span>
                </li>
              ))}
            </ul>
            <p className="m-0 text-[12px] text-muted-foreground">
              Delivery status is separate from render status. A failed delivery never changes a finished video.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
