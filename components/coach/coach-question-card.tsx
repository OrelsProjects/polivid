"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";

export function CoachQuestionCard({
  question,
  options,
  onAnswer,
  answered,
}: {
  question: string;
  options?: string[];
  onAnswer: (answer: string) => void;
  answered?: string;
}) {
  const questionId = useId();
  const [draft, setDraft] = useState("");
  const choices = options ?? [];
  const freeText = choices.length === 0;

  return (
    <section aria-labelledby={questionId} className="mt-3 rounded-2xl border border-border bg-surface p-4">
      <p id={questionId} className="text-sm font-medium">
        {question}
      </p>
      {answered ? (
        <p className="mt-2 text-xs text-muted-foreground">
          You answered: <span className="text-foreground">{answered}</span>
        </p>
      ) : freeText ? (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (value) onAnswer(value);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-labelledby={questionId}
            placeholder="Type your answer"
            className="h-10 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          />
          <div className="flex gap-2">
            <Button type="submit" className="h-10 rounded-xl px-4" disabled={!draft.trim()}>
              Answer
            </Button>
            <Button type="button" variant="ghost" className="h-10 rounded-xl px-4" onClick={() => onAnswer("Skip")}>
              Skip
            </Button>
          </div>
        </form>
      ) : (
        <div role="group" aria-labelledby={questionId} className="mt-3 flex flex-wrap gap-2">
          {choices.map((option) => (
            <Button
              key={option}
              type="button"
              variant="outline"
              className="h-10 rounded-xl px-4 whitespace-normal"
              onClick={() => onAnswer(option)}
            >
              {option}
            </Button>
          ))}
          <Button type="button" variant="ghost" className="h-10 rounded-xl px-4" onClick={() => onAnswer("Skip")}>
            Skip
          </Button>
        </div>
      )}
    </section>
  );
}
