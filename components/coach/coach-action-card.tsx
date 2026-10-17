import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import Link from "next/link";
import type { ToolResultTone } from "@/lib/tools/result";
import { cn } from "@/lib/utils";

const ICONS = {
  done: CircleCheck,
  working: LoaderCircle,
  error: CircleAlert,
} as const;

export function CoachActionCard({
  label,
  state,
  tone = "done",
  href,
  linkLabel,
}: {
  label: string;
  state: string;
  tone?: ToolResultTone;
  href?: string;
  linkLabel?: string;
}) {
  const Icon = ICONS[tone];
  return (
    <div
      className={cn(
        "mt-2 flex items-start gap-2 text-xs",
        tone === "error"
          ? "rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-foreground"
          : "text-muted-foreground",
      )}
      role={tone === "error" ? "alert" : undefined}
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-px size-3.5 shrink-0",
          tone === "working" && "motion-safe:animate-spin",
          tone === "error" && "text-destructive",
          tone === "done" && "text-primary",
        )}
      />
      <p className="min-w-0 [overflow-wrap:anywhere]">
        <span className="font-medium text-foreground">{label}</span>
        {state ? <span> · {state}</span> : null}
        {href && linkLabel ? (
          <>
            <span aria-hidden> · </span>
            <Link
              href={href}
              className="rounded-sm font-medium text-foreground underline decoration-primary underline-offset-4 outline-none hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {linkLabel}
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
