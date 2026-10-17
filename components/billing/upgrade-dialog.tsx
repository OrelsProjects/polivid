"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type MouseEvent } from "react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="upgrade-title"
      onClose={onClose}
      onClick={handleBackdropClick}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-card p-0 text-foreground shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px] open:animate-in open:fade-in-0 open:zoom-in-95"
    >
      <div className="relative p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
        <h2 id="upgrade-title" className="pr-8 text-lg font-semibold">
          You need more credits
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This needs {required.toLocaleString()} credits. You have {balance.toLocaleString()} left. Subscribe or buy a
          boost to keep generating.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/billing" autoFocus className={cn(buttonVariants(), "h-10 rounded-xl px-4")}>
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
    </dialog>
  );
}
