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
  ready: "bg-[#E3F5EA] text-[#157347]",
  attention: "bg-[#FFF1D6] text-[#9A5B00]",
  failed: "bg-[#FDE8EA] text-[#C2263A]",
  rendering: "bg-[#E6EEFC] text-[#1D5FD6]",
  neutral: "bg-[#EFEFF3] text-[#6B6A7B]",
  primary: "bg-[#EFEAFE] text-[#4A23C9]",
};

/** Text-only colour for a tone, used by status lines under cards. */
export const TONE_TEXT: Record<Tone, string> = {
  ready: "text-[#157347]",
  attention: "text-[#9A5B00]",
  failed: "text-[#C2263A]",
  rendering: "text-[#1D5FD6]",
  neutral: "text-[#6B6A7B]",
  primary: "text-[#4A23C9]",
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
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E4E4EC] bg-white px-2.5 py-1 text-[12px] text-[#6B6A7B]">
      <span aria-hidden="true" className="size-2 rounded-full bg-[#9A5B00]" />
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
        {lede ? <p className="m-0 text-[15px] text-[#6B6A7B]">{lede}</p> : null}
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
      className={cn("m-0 font-sans text-[13px] font-semibold tracking-[0.06em] text-[#6B6A7B] uppercase", className)}
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
    <Tag className={cn("flex flex-col rounded-[20px] border border-[#E4E4EC] bg-white", className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Sidebar plan card. `badge` marks sample numbers; `action` links to billing for a real account. */
export function PlanCardView({
  name,
  balance,
  low,
  badge,
  action,
}: {
  name: string;
  balance: number;
  low?: boolean;
  badge?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[14px] border px-3.5 py-3",
        low ? "border-[#E3C78A] bg-[#FFF8EA]" : "border-[#E4E4EC] bg-[#FAFAFC]",
      )}
    >
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="font-semibold">{name}</span>
        {action ? (
          <Link href={action.href} className="text-[12px] font-medium text-[#4A23C9] hover:text-[#3A1AA6]">
            {action.label}
          </Link>
        ) : badge ? (
          <span
            className={cn(
              "rounded-full border px-2 py-px text-[11px] text-[#6B6A7B]",
              low ? "border-[#E3C78A]" : "border-[#E4E4EC]",
            )}
          >
            {badge}
          </span>
        ) : null}
      </div>
      <div className="text-[13px] text-[#3F3D4F]">
        <strong className={cn("font-semibold tabular-nums", low ? "text-[#9A5B00]" : "text-[#141321]")}>
          {balance.toLocaleString("en-US")}
        </strong>{" "}
        credits left{low ? " · low" : ""}
      </div>
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
      className={cn("flex items-center justify-center rounded-[10px] bg-[#E9E8F1] text-[12px] text-[#6B6A7B]", className)}
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
    "inline-flex items-center justify-center gap-2 rounded-full border-0 bg-[#5B2EE6] font-medium text-white disabled:cursor-not-allowed disabled:bg-[#B9B4D6]",
  outline:
    "inline-flex items-center justify-center gap-2 rounded-full border border-[#5B2EE6] bg-white font-medium text-[#4A23C9]",
  quiet:
    "inline-flex items-center justify-center gap-2 rounded-full border border-[#E4E4EC] bg-white font-medium text-[#3F3D4F] disabled:cursor-not-allowed disabled:text-[#8A8899]",
};

/** Toggle chip colours: selected = primary ring + tint. */
export function toggle(on: boolean) {
  return on ? "border-[#5B2EE6] bg-[#EFEAFE] text-[#4A23C9]" : "border-[#E4E4EC] bg-white text-[#3F3D4F]";
}
