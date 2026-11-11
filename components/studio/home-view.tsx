"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { btn, Chip, Kicker, PageHeader, Placeholder, PrototypePill, SectionTitle, toggle, TONE_TEXT, type Tone } from "./studio-ui";
import { STUDIO_HREF } from "./studio-links";

const INPUTS = ["Idea", "Exact script", "Article or link", "Music or audio", "Your media"];

export type HomeNeed = {
  tone: Tone;
  chip: string;
  title: string;
  meta: string;
  action: string;
  href: string;
  primary?: boolean;
};

export type HomeContinue = { title: string; status: string; tone: Tone; preview: string; href: string };

const SHOWCASE: { title: string; meta: string; mark: string; tile: string; href: string }[] = [
  {
    title: "What is a transformer?",
    meta: "Topic · 60s · 9:16 · Motion graphics",
    mark: "BOLD",
    tile: "bg-foreground font-heading text-[13px] font-bold text-white",
    href: "/studio/create?brief=What%20is%20a%20transformer%3F&length=60&format=9%3A16",
  },
  {
    title: "A short history of the espresso",
    meta: "Topic · 60s · 9:16 · Motion graphics",
    mark: "Editorial",
    tile: "bg-amber-400/10 [font-family:Georgia,serif] text-[13px] text-foreground italic",
    href: "/studio/create?brief=A%20short%20history%20of%20the%20espresso&length=60&format=9%3A16",
  },
  {
    title: "Our October newsletter, as a video",
    meta: "Article · 90s · 16:9 · Motion graphics",
    mark: "Minimal",
    tile: "bg-border text-[12px] text-foreground/80",
    href: "/studio/create?brief=Turn%20our%20October%20newsletter%20into%20a%20video&length=90&format=16%3A9",
  },
];

export function HomeView({
  greeting,
  needs = [],
  continueItems = [],
}: {
  greeting: string;
  needs?: HomeNeed[];
  continueItems?: HomeContinue[];
}) {
  const [input, setInput] = useState(INPUTS[0]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        size={32}
        title={greeting}
        lede="What should we make today?"
        aside={<PrototypePill>Prototype · sample data, nothing is generated</PrototypePill>}
      />

      <section
        aria-labelledby="start-title"
        className="flex flex-col gap-3.5 rounded-[20px] border border-border bg-card px-[22px] pt-5 pb-[18px]"
      >
        <Kicker id="start-title">Start a video</Kicker>
        <label htmlFor="home-input" className="sr-only">
          What is the video about
        </label>
        <textarea
          id="home-input"
          rows={3}
          placeholder="An idea, an exact script, a pasted article or link, or a song. One line is enough to start."
          className="min-h-24 w-full resize-y rounded-[14px] border border-border bg-muted px-4 py-3.5 text-[15px] text-foreground"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="What you are starting from" className="flex flex-wrap gap-2">
            {INPUTS.map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={input === label}
                onClick={() => setInput(label)}
                className={cn("h-9 cursor-pointer rounded-full border px-3.5 font-medium", toggle(input === label))}
              >
                {label}
              </button>
            ))}
          </div>
          <Link href={STUDIO_HREF.create} className={cn(btn.primary, "h-11 px-5")}>
            Continue to Create
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </section>

      <section aria-labelledby="attention-title" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <SectionTitle id="attention-title">Needs you</SectionTitle>
          <Link href={STUDIO_HREF.projects} className="text-[13px] font-medium text-primary hover:text-primary/80">
            All projects
          </Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-3.5">
          {needs.length === 0 ? (
            <p className="m-0 text-[13px] text-muted-foreground">Nothing is waiting. Start a video above.</p>
          ) : null}
          {needs.map((item) => (
            <article
              key={item.title}
              className="flex flex-col gap-2.5 rounded-[16px] border border-border bg-card px-[18px] py-4"
            >
              <Chip tone={item.tone} className="self-start">
                {item.chip}
              </Chip>
              <h3 className="m-0 text-[15px] font-semibold">{item.title}</h3>
              <p className="m-0 text-[13px] text-muted-foreground">{item.meta}</p>
              <Link
                href={item.href}
                className={cn(item.primary ? btn.primary : btn.outline, "mt-auto h-9 self-start px-3.5")}
              >
                {item.action}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="continue-title" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <SectionTitle id="continue-title">Continue</SectionTitle>
          <Link href={STUDIO_HREF.projects} className="text-[13px] font-medium text-primary hover:text-primary/80">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(210px,100%),1fr))] gap-3.5">
          {continueItems.map((item) => (
            <Link
              key={item.title}
              href={item.href}
              className="flex flex-col gap-2.5 rounded-[16px] border border-border bg-card p-2.5 text-inherit"
            >
              <Placeholder ratio="9 / 16" className="max-h-[220px]">
                {item.preview}
              </Placeholder>
              <div className="flex flex-col gap-1 px-1 pb-1">
                <span className="text-[14px] font-semibold">{item.title}</span>
                <span className={cn("text-[12px] font-medium", TONE_TEXT[item.tone])}>{item.status}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="showcase-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <SectionTitle id="showcase-title">Start from a showcase</SectionTitle>
          <p className="m-0 text-[13px] text-muted-foreground">Opens Create with the prompt and settings prefilled.</p>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3.5">
          {SHOWCASE.map((item) => (
            <article key={item.title} className="flex gap-3 rounded-[16px] border border-border bg-card p-2.5">
              <div
                role="img"
                aria-label="Preview placeholder"
                className={cn("flex aspect-[9/16] w-24 shrink-0 items-end rounded-[10px] p-2", item.tile)}
              >
                {item.mark}
              </div>
              <div className="flex flex-auto flex-col gap-1.5 py-1 pr-1">
                <span className="text-[14px] font-semibold">{item.title}</span>
                <span className="text-[12px] text-muted-foreground">{item.meta}</span>
                <Link
                  href={item.href}
                  className="mt-auto self-start text-[13px] font-medium text-primary hover:text-primary/80"
                >
                  Create similar
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
