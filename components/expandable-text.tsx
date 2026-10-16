"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const collapse = (text: string, limit: number) => {
  if (text.length <= limit) return text;
  const slice = text.slice(0, limit);
  const lastSpace = slice.lastIndexOf(" ");
  const base = lastSpace > limit * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${base.trimEnd()}…`;
};

export const ExpandableText = ({
  text,
  limit = 140,
  className,
  placement = "inline",
}: {
  text: string;
  limit?: number;
  className?: string;
  placement?: "inline" | "below";
}) => {
  const [expanded, setExpanded] = useState(false);
  const long = text.length > limit;
  const shown = long && !expanded ? collapse(text, limit) : text;

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {shown}
      {long ? (
        <button
          type="button"
          className={cn(
            "font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            placement === "below" ? "mt-1 block text-xs" : "ml-1 inline",
          )}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </span>
  );
};
