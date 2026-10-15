"use client";

import type { KeyboardEvent } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function UpgradeDialog({
  open,
  required,
  balance,
  onClose,
}: {
  open: boolean;
  required: number;
  balance: number;
  onClose: () => void;
}) {
  if (!open) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-title"
      tabIndex={0}
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="upgrade-title" className="text-lg font-semibold">
          You need more credits
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This needs {required.toLocaleString()} credits. You have {balance.toLocaleString()} left. Subscribe or buy a
          boost to keep generating.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/billing" className={cn(buttonVariants(), "h-10 rounded-xl px-4")}>
            See plans
          </Link>
          <button
            type="button"
            onClick={onClose}
            className={cn(buttonVariants({ variant: "outline" }), "h-10 rounded-xl px-4")}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
