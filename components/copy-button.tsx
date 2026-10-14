"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-xl border border-border bg-white px-3 py-1.5 text-xs font-medium hover:bg-muted"
    >
      {copied ? "Copied" : "Copy for description"}
    </button>
  );
}
