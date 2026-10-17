"use client";

import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { ExpandableText } from "@/components/expandable-text";
import type { JobDetailRow } from "@/lib/video/job-status";

const GROUPS = ["Tool", "This video"] as const;

export const JobDetailsDialog = ({
  open,
  title,
  rows,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  rows: JobDetailRow[];
  onOpenChange: (open: boolean) => void;
}) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
        <Dialog.Popup className="relative max-h-[min(36rem,calc(100vh-2rem))] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-border bg-card p-5 pt-12 shadow-lg outline-none">
          <Dialog.Close
            aria-label="Close"
            className="absolute top-3 right-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X className="size-4" aria-hidden />
          </Dialog.Close>
          <Dialog.Title className="text-lg font-semibold">More info</Dialog.Title>
          <Dialog.Description className="sr-only">Tool and settings for {title}</Dialog.Description>
          <div className="mt-5 flex flex-col gap-5">
            {GROUPS.map((group) => {
              const items = rows.filter((row) => row.group === group);
              if (items.length === 0) return null;
              return (
                <section key={group} aria-label={group}>
                  <h3 className="text-sm font-medium">{group}</h3>
                  <dl className="mt-2 flex flex-col gap-3">
                    {items.map((row) => (
                      <div key={`${group}-${row.label}`} className="flex flex-col gap-0.5">
                        <dt className="text-xs text-muted-foreground">{row.label}</dt>
                        <dd className="text-sm">
                          <ExpandableText text={row.value} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              );
            })}
          </div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
);
