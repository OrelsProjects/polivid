"use client";

import { Menu } from "@base-ui/react/menu";
import { EllipsisVertical } from "lucide-react";
import { useState } from "react";
import { JobDetailsDialog } from "@/components/job-details-dialog";
import { cn } from "@/lib/utils";
import type { JobDetailRow } from "@/lib/video/job-status";

export const JobMoreMenu = ({ title, rows, className }: { title: string; rows: JobDetailRow[]; className?: string }) => {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`More options for ${title}`}
          className={cn(
            "absolute top-1.5 left-1.5 z-10 inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:bg-muted",
            className,
          )}
        >
          <EllipsisVertical className="size-4" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={4} className="z-50">
            <Menu.Popup className="min-w-36 origin-(--transform-origin) rounded-xl border border-border bg-white p-1 shadow-lg outline-none">
              <Menu.Item
                label="More info"
                className="cursor-pointer rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                onClick={() => {
                  window.setTimeout(() => setInfoOpen(true), 0);
                }}
              >
                More info
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <JobDetailsDialog open={infoOpen} title={title} rows={rows} onOpenChange={setInfoOpen} />
    </>
  );
};
