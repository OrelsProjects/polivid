"use client";

import { Menu } from "@base-ui/react/menu";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { apiErrorMessage, apiErrorStatus, loginPath } from "@/lib/store/api-errors";
import { useRetryVideoMutation } from "@/lib/store/endpoints/videos";
import { cn } from "@/lib/utils";

const itemClass =
  "flex min-h-11 w-full cursor-pointer flex-col items-start justify-center rounded-lg px-3 py-2 text-left outline-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[highlighted]:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

export const RetryVideoMenu = ({
  videoId,
  scratchHref,
  clipsReady,
  clipTotal,
}: {
  videoId: string;
  scratchHref: string;
  clipsReady: number;
  clipTotal: number;
}) => {
  const router = useRouter();
  const [retryVideo, { isLoading }] = useRetryVideoMutation();
  const [error, setError] = useState<string | null>(null);
  const canResume = clipsReady > 0;
  const nextClip = clipsReady + 1;
  const resumeDetail =
    clipsReady < 1
      ? "No clips were saved"
      : clipsReady >= clipTotal
        ? "Finish with the clips already filmed"
        : `Continue at clip ${nextClip} of ${clipTotal}`;

  const handleResume = async () => {
    if (isLoading || !canResume) return;
    setError(null);
    try {
      await retryVideo(videoId).unwrap();
      router.refresh();
    } catch (caught) {
      if (apiErrorStatus(caught) === 401) {
        router.push(loginPath(`/videos/${videoId}`));
        return;
      }
      setError(apiErrorMessage(caught, "Couldn't continue this video."));
    }
  };

  return (
    <div className="mt-2 flex flex-col items-start gap-2">
      <Menu.Root>
        <Menu.Trigger
          className={cn(buttonVariants({ variant: "outline", size: "default" }), "min-h-11 bg-card")}
          aria-label="Try again"
          disabled={isLoading}
        >
          {isLoading ? "Continuing…" : "Try again"}
          <ChevronDown className="size-4" aria-hidden />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="start" sideOffset={6} className="z-50">
            <Menu.Popup className="w-64 origin-(--transform-origin) rounded-xl border border-border bg-card p-1 shadow-lg outline-none">
              <Menu.Item
                label="From last point"
                className={itemClass}
                disabled={!canResume || isLoading}
                onClick={() => {
                  void handleResume();
                }}
              >
                <span className="text-sm font-medium">From last point</span>
                <span className="text-xs text-muted-foreground">{resumeDetail}</span>
              </Menu.Item>
              <Menu.LinkItem
                href={scratchHref}
                label="From scratch"
                closeOnClick
                className={itemClass}
              >
                <span className="text-sm font-medium">From scratch</span>
                <span className="text-xs text-muted-foreground">Start a new video with the same prompt</span>
              </Menu.LinkItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
