"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type CopyState = "idle" | "copied" | "failed";

const LABEL: Record<CopyState, string> = {
  idle: "Copy for description",
  copied: "Copied",
  failed: "Couldn't copy",
};

export function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<CopyState>("idle");

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2000);
  };

  const Icon = state === "copied" ? Check : Copy;

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-live="polite"
      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-medium transition-colors hover:bg-muted"
    >
      <Icon className="size-3.5" aria-hidden />
      {LABEL[state]}
    </button>
  );
}
