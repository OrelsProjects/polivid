"use client";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useMotionSafe } from "@/components/motion/motion";

type CopyState = "idle" | "copied" | "failed";

const LABEL: Record<Exclude<CopyState, "idle">, string> = {
  copied: "Copied",
  failed: "Couldn't copy",
};

export function CopyButton({ text, label = "Copy for description" }: { text: string; label?: string }) {
  const safe = useMotionSafe();
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
      className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-xs font-medium transition-colors hover:bg-muted"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state === "copied" ? "copied" : state === "failed" ? "failed" : "idle"}
          initial={safe ? { opacity: 0, y: 3 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={safe ? { opacity: 0, y: -3, transition: { duration: 0.1 } } : undefined}
          transition={safe ? { duration: 0.16 } : { duration: 0 }}
          className="inline-flex items-center gap-1.5"
        >
          <Icon className="size-3.5" aria-hidden />
          {state === "idle" ? label : LABEL[state]}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
