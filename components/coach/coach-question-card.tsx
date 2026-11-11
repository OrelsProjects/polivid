"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { JUST_MAKE_IT_TEXT } from "@/lib/coach/run-wild-notes";

const fieldClass =
  "min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm";

export function CoachQuestionCard({
  question,
  options,
  onAnswer,
  onEdit,
  answered,
  disabled = false,
}: {
  question: string;
  options?: string[];
  onAnswer: (answer: string) => void;
  /** Replaces an answer that was already sent. */
  onEdit?: (answer: string) => void;
  answered?: string;
  disabled?: boolean;
}) {
  const questionId = useId();
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState(answered);
  const choices = options ?? [];
  const freeText = choices.length === 0;
  const current = shown ?? answered;
  const answerLabel = current === JUST_MAKE_IT_TEXT ? "Just make it" : current;

  useEffect(() => {
    setShown(answered);
    setEditing(false);
  }, [answered]);

  useEffect(() => {
    if (editing) draftRef.current?.focus();
  }, [editing]);

  return (
    <section aria-labelledby={questionId} className="mt-3 rounded-2xl border border-border bg-surface p-4">
      <p id={questionId} className="text-sm font-medium">
        {question}
      </p>
      {current && !editing ? (
        <div className="mt-2 flex items-start gap-3">
          <p className="min-w-0 flex-1 text-xs text-muted-foreground">
            You answered: <span className="text-foreground">{answerLabel}</span>
          </p>
          {onEdit ? (
            <Button
              type="button"
              variant="ghost"
              className="h-8 shrink-0 rounded-lg px-2 text-xs"
              disabled={disabled}
              onClick={() => {
                setDraft(current === JUST_MAKE_IT_TEXT ? "" : current);
                setEditing(true);
              }}
            >
              Edit
            </Button>
          ) : null}
        </div>
      ) : current && editing ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = draft.trim();
            if (!value || value === current || !onEdit) {
              setEditing(false);
              return;
            }
            setShown(value);
            setEditing(false);
            onEdit(value);
          }}
        >
          {choices.length > 0 ? (
            <div role="group" aria-labelledby={questionId} className="flex flex-wrap gap-2">
              {choices.map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={option === current ? "default" : "outline"}
                  className="h-10 rounded-xl px-4 whitespace-normal"
                  disabled={disabled}
                  onClick={() => {
                    if (option === current) {
                      setEditing(false);
                      return;
                    }
                    setShown(option);
                    setEditing(false);
                    onEdit?.(option);
                  }}
                >
                  {option}
                </Button>
              ))}
            </div>
          ) : null}
          <textarea
            ref={draftRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-labelledby={questionId}
            rows={2}
            placeholder="Type a different answer"
            disabled={disabled}
            className={`max-h-40 min-h-10 w-full resize-none py-2 ${fieldClass}`}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="h-10 rounded-xl px-4" disabled={disabled || !draft.trim() || draft.trim() === current}>
              Save
            </Button>
            <Button type="button" variant="ghost" className="h-10 rounded-xl px-4" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </form>
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
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="h-10 rounded-xl px-4" disabled={!draft.trim()}>
              Answer
            </Button>
            <Button type="button" variant="ghost" className="h-10 rounded-xl px-4" onClick={() => onAnswer("Skip")}>
              Skip
            </Button>
            <Button type="button" variant="ghost" className="h-10 rounded-xl px-4" onClick={() => onAnswer(JUST_MAKE_IT_TEXT)}>
              Just make it
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3">
          <div role="group" aria-labelledby={questionId} className="flex flex-wrap gap-2">
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
            <Button type="button" variant="ghost" className="h-10 rounded-xl px-4" onClick={() => onAnswer(JUST_MAKE_IT_TEXT)}>
              Just make it
            </Button>
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const value = draft.trim();
              if (value) onAnswer(value);
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label="Or type your own answer"
              placeholder="Or type your own"
              className={`h-10 ${fieldClass}`}
            />
            <Button type="submit" variant="outline" className="h-10 rounded-xl px-4" disabled={!draft.trim()}>
              Answer
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
