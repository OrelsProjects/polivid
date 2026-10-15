"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const PROMPT_IDEAS = [
  "Why sleep matters for memory",
  "Explain how compound interest works",
  "Five habits that improve focus",
  "How coffee affects sleep, in numbers",
];

/** Sends a prompt to the Create page, which starts generating right away. */
export function PromptBox({
  className,
  placeholder = "A topic, a pasted article, or notes to turn into a video",
}: {
  className?: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  const go = (text: string) => {
    const value = text.trim();
    if (!value) return;
    router.push(`/create?prompt=${encodeURIComponent(value)}&start=1`);
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        go(prompt);
      }}
      className={cn("rounded-2xl border border-border bg-white p-3 shadow-sm", className)}
    >
      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            go(prompt);
          }
        }}
        placeholder={placeholder}
        rows={2}
        aria-label="Video prompt"
        className="min-h-16 resize-none border-0 bg-transparent px-2 text-base shadow-none focus-visible:ring-0 md:text-base"
      />
      <div className="flex items-center justify-between gap-3 px-2 pt-1 pb-1">
        <span className="text-xs text-muted-foreground">
          <kbd className="font-sans font-medium text-foreground">Enter</kbd> to generate
          <span className="hidden sm:inline">
            {" "}
            · <kbd className="font-sans font-medium text-foreground">Shift + Enter</kbd> for a new line
          </span>
        </span>
        <Button type="submit" size="lg" disabled={!prompt.trim()} className="h-10 rounded-xl px-4">
          Generate
          <ArrowRight data-icon="inline-end" />
        </Button>
      </div>
    </form>
  );
}
