import { cn } from "@/lib/utils";
import type { VisualStyle } from "@/lib/showcase";

const FRAME = {
  bold: "bg-[#0C1222] text-white",
  minimal: "border border-[#E4E6EC] bg-[#F4F5F7] text-[#16181D]",
  editorial: "bg-[#F4EFE6] text-[#2C261F]",
} as const;

const RULE = {
  bold: "bg-[#F5B942]",
  minimal: "bg-[#16181D]",
  editorial: "bg-[#A33B32]",
} as const;

const KICKER = {
  bold: "text-[#F5B942]",
  minimal: "text-[#7A808A]",
  editorial: "text-[#A33B32]",
} as const;

/** Portrait poster used in the showcase and on video-style pickers. */
export function StylePoster({
  style,
  title,
  className,
  size = "md",
}: {
  style: VisualStyle;
  title?: string;
  className?: string;
  size?: "md" | "sm" | "picker";
}) {
  const compact = size === "sm" || size === "picker";
  const picker = size === "picker";
  return (
    <div
      className={cn(
        "relative flex aspect-[9/14] flex-col overflow-hidden rounded-2xl shadow-sm",
        compact ? "p-2" : "p-4",
        FRAME[style],
        className,
      )}
    >
      <span className={cn("h-0.5 rounded-full", compact ? "w-4" : "w-8", RULE[style])} />
      {title ? (
        <span
          className={cn(
            "font-semibold tracking-[0.16em]",
            compact ? "mt-1 text-[8px]" : "mt-3 text-[10px]",
            KICKER[style],
          )}
        >
          {style.toUpperCase()}
        </span>
      ) : null}
      {title ? (
        <p
          className={cn(
            "mt-auto leading-tight font-semibold tracking-tight text-balance",
            picker ? "text-4xl" : compact ? "text-[10px]" : "text-lg",
            style === "editorial" && !compact && "font-serif text-xl font-normal",
            style === "editorial" && compact && "font-serif font-normal",
          )}
        >
          {title}
        </p>
      ) : null}
    </div>
  );
}

/** The three hero samples. Bold is the style videos render in today. */
export function HeroStyles() {
  return (
    <div className="mx-auto mt-16 flex max-w-4xl items-end justify-center px-4">
      <SampleCard className="hidden w-60 translate-y-8 pr-10 sm:flex" style="minimal">
        <span className={cn("text-[10px] font-semibold tracking-[0.16em]", KICKER.minimal)}>MINIMAL</span>
        <p className="mt-auto text-4xl font-semibold tracking-tight">40%</p>
        <p className="mt-2 text-xs leading-snug text-[#5C6370]">more remembered after a night of sleep</p>
        <p className="mt-6 text-[10px] text-[#8B909A]">Sample data</p>
      </SampleCard>

      <SampleCard className="z-10 -mx-6 w-full max-w-72 shadow-2xl shadow-black/25" style="bold">
        <div className="flex items-center justify-between text-[10px] font-semibold tracking-[0.16em]">
          <span className="text-white/50">POLIVID</span>
          <span className={KICKER.bold}>BOLD</span>
        </div>
        <p className="mt-8 text-[1.65rem] leading-[1.05] font-semibold tracking-tight text-balance">
          Why sleep matters for memory
        </p>
        <p className="mt-3 text-xs leading-snug text-white/60">Three things that happen while you&apos;re out cold.</p>
        <p className="mt-auto pt-8 text-sm leading-snug">
          Here&apos;s what your brain does <span className="text-[#F5B942]">while you sleep</span>
        </p>
      </SampleCard>

      <SampleCard className="hidden w-60 translate-y-8 pl-10 sm:flex" style="editorial">
        <span className={cn("text-[10px] font-semibold tracking-[0.16em]", KICKER.editorial)}>
          EDITORIAL · QUOTE
        </span>
        <p className="mt-6 font-serif text-lg leading-snug italic text-balance">
          “Sleep is when the day&apos;s learning gets filed.”
        </p>
        <p className="mt-3 text-xs text-[#6B5E52]">— Sample researcher</p>
        <p className="mt-auto pt-6 text-[10px] text-[#8A7B6E]">Sample data</p>
      </SampleCard>
    </div>
  );
}

function SampleCard({
  style,
  className,
  children,
}: {
  style: VisualStyle;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex aspect-[9/15] flex-col rounded-[1.4rem] p-5", FRAME[style], className)}>
      <span className={cn("mb-4 h-0.5 w-8 rounded-full", RULE[style])} />
      {children}
    </div>
  );
}

/** Static preview on the create page. The rendered video uses the Bold palette. */
export function PreviewSample({ className }: { className?: string }) {
  return (
    <div className={cn("flex aspect-[9/14] flex-col rounded-[1.4rem] p-5", FRAME.bold, className)}>
      <span className={cn("h-0.5 w-10 rounded-full", RULE.bold)} />
      <span className={cn("mt-6 text-[10px] font-semibold tracking-[0.16em]", KICKER.bold)}>
        SCENE · BIG NUMBER
      </span>
      <p className="mt-3 text-5xl font-semibold tracking-tight">40%</p>
      <p className="mt-2 text-sm leading-snug text-white/80">more remembered after a night of sleep</p>
      <p className="mt-auto text-[10px] text-white/45">Sample data</p>
    </div>
  );
}
