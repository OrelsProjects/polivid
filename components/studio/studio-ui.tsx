import { Coins, Crown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Shared pieces for the Studio preview. Values come straight from
 * design/studio-prototype/HANDOFF.md; the screens themselves are ports of
 * the *.dc.html prototypes.
 */

export type Tone = "ready" | "attention" | "failed" | "rendering" | "neutral" | "primary";

export const TONE: Record<Tone, string> = {
  ready: "bg-emerald-400/10 text-emerald-300",
  attention: "bg-amber-400/15 text-amber-300",
  failed: "bg-red-400/10 text-red-300",
  rendering: "bg-sky-400/10 text-sky-300",
  neutral: "bg-secondary text-muted-foreground",
  primary: "bg-accent text-primary",
};

/** Text-only colour for a tone, used by status lines under cards. */
export const TONE_TEXT: Record<Tone, string> = {
  ready: "text-emerald-300",
  attention: "text-amber-300",
  failed: "text-red-300",
  rendering: "text-sky-300",
  neutral: "text-muted-foreground",
  primary: "text-primary",
};

/** Status chip: 12px semibold on a tinted pill. */
export function Chip({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-[12px] font-semibold", TONE[tone], className)}>
      {children}
    </span>
  );
}

/** The amber-dot "Prototype · …" marker shown top right of every screen. */
export function PrototypePill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[12px] text-muted-foreground">
      <span aria-hidden="true" className="size-2 rounded-full bg-amber-300" />
      {children}
    </span>
  );
}

/** Page title + lede on the left, prototype marker (or actions) on the right. */
export function PageHeader({
  title,
  lede,
  aside,
  size = 30,
}: {
  title: ReactNode;
  lede?: ReactNode;
  aside?: ReactNode;
  size?: 30 | 32;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1
          className={cn(
            "m-0 font-heading leading-[1.15] font-semibold tracking-normal",
            size === 32 ? "text-[32px]" : "text-[30px]",
          )}
        >
          {title}
        </h1>
        {lede ? <p className="m-0 text-[15px] text-muted-foreground">{lede}</p> : null}
      </div>
      {aside}
    </header>
  );
}

/** 13px uppercase section label (Geist, not Syne). */
export function Kicker({
  children,
  id,
  as: Tag = "h2",
  className,
}: {
  children: ReactNode;
  id?: string;
  as?: "h2" | "h3" | "div" | "span";
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn("m-0 font-sans text-[13px] font-semibold tracking-[0.06em] text-muted-foreground uppercase", className)}
    >
      {children}
    </Tag>
  );
}

/** Syne 600 section heading (20px by default, 18px inside cards). */
export function SectionTitle({
  children,
  id,
  size = 20,
  as: Tag = "h2",
  className,
}: {
  children: ReactNode;
  id?: string;
  size?: 18 | 20 | 22;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn(
        "m-0 font-heading font-semibold tracking-normal",
        size === 18 ? "text-[18px]" : size === 22 ? "text-[22px]" : "text-[20px]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** White card, 20px radius, 1px hairline. */
export function Card({
  children,
  className,
  as: Tag = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
  "aria-label"?: string;
  "aria-labelledby"?: string;
}) {
  return (
    <Tag className={cn("flex flex-col rounded-[20px] border border-border bg-card", className)} {...rest}>
      {children}
    </Tag>
  );
}

/**
 * Credits in the top bar. `badge` marks sample numbers; `action` links to billing for a real account.
 */
export function CreditsPill({
  balance,
  low,
  badge,
  action,
}: {
  balance: number;
  low?: boolean;
  badge?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div
      className={cn(
        "flex h-[52px] items-center gap-2.5 rounded-2xl border bg-card/90 py-0 pr-1.5 pl-3.5 backdrop-blur-md",
        low ? "border-amber-400/30" : "border-border",
      )}
    >
      <span
        className={cn("flex items-center gap-1.5 text-[15px] font-semibold tabular-nums", low && "text-amber-300")}
        aria-label={`${balance.toLocaleString("en-US")} credits left${low ? ", low" : ""}`}
      >
        <Coins className="size-4 text-muted-foreground" aria-hidden />
        {balance.toLocaleString("en-US")}
      </span>
      {action ? (
        <Link
          href={action.href}
          className="flex h-10 items-center gap-2 rounded-xl bg-amber-400/15 px-3.5 text-[15px] font-semibold text-foreground hover:bg-amber-400/25"
        >
          <Crown className="size-[17px] text-amber-400" aria-hidden />
          <span className="hidden sm:inline">{action.label}</span>
        </Link>
      ) : badge ? (
        <span className="mr-2 rounded-full border border-border px-2 py-px text-[11px] text-muted-foreground">
          {badge}
        </span>
      ) : (
        <span className="w-1" />
      )}
    </div>
  );
}

/** Grey placeholder used until real previews exist. */
export function Placeholder({
  children,
  className,
  ratio,
  label = "Preview placeholder",
}: {
  children?: ReactNode;
  className?: string;
  ratio?: string;
  label?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn("flex items-center justify-center rounded-[10px] bg-border text-[12px] text-muted-foreground", className)}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {children}
    </div>
  );
}

/*
 * Button looks. Every button in the prototype is a full pill; heights vary
 * (44 primary, 36–40 secondary). Compose with a height class: `btn.primary + " h-11 px-5"`.
 */
export const btn = {
  base: "inline-flex items-center justify-center gap-2 rounded-full font-medium",
  primary:
    "inline-flex items-center justify-center gap-2 rounded-full border-0 bg-primary font-medium text-white disabled:cursor-not-allowed disabled:bg-primary/40",
  outline:
    "inline-flex items-center justify-center gap-2 rounded-full border border-primary bg-card font-medium text-primary",
  quiet:
    "inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card font-medium text-foreground/80 disabled:cursor-not-allowed disabled:text-muted-foreground",
};

/** Toggle chip colours: selected = primary ring + tint. */
export function toggle(on: boolean) {
  return on ? "border-primary bg-accent text-primary" : "border-border bg-card text-foreground/80";
}
