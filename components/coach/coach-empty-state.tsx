"use client";

import { Captions, ImagePlus, Music, Sparkles, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import { useMotionSafe } from "@/components/motion/motion";

const STARTERS: { icon: LucideIcon; text: string }[] = [
  { icon: Sparkles, text: "Plan a 30s Reel about why sleep matters for memory." },
  { icon: ImagePlus, text: "Make a picture of a lighthouse at dawn, then animate it." },
  { icon: Music, text: "Write a short song about Monday mornings and make a lyrics video." },
  { icon: Captions, text: "Add captions to a video I upload." },
];

export function CoachEmptyState({ onPick }: { onPick: (text: string) => void }) {
  const safe = useMotionSafe();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-balance">What should we make?</h2>
        <p className="mt-2 text-sm text-pretty text-muted-foreground">
          Talk through the idea. I&apos;ll pick a style and start anything under 200 credits. Larger jobs wait for your approval.
        </p>
      </div>
      <ul className="grid w-full gap-2 sm:grid-cols-2" aria-label="Ideas to start with">
        {STARTERS.map(({ icon: Icon, text }) => (
          <li key={text}>
            <motion.button
              type="button"
              onClick={() => onPick(text)}
              whileHover={safe ? { y: -2 } : undefined}
              whileTap={safe ? { scale: 0.98 } : undefined}
              transition={{ type: "spring", stiffness: 460, damping: 34 }}
              className="flex h-full min-h-14 w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-3 text-left text-sm text-foreground/90 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <span>{text}</span>
            </motion.button>
          </li>
        ))}
      </ul>
    </div>
  );
}
