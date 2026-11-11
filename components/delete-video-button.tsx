"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage, apiErrorStatus, loginPath } from "@/lib/store/api-errors";
import { useDeleteVideoMutation } from "@/lib/store/endpoints/videos";
import { cn } from "@/lib/utils";

/** Asks once, then removes the video, its job, and its files. */
export const DeleteVideoButton = ({
  id,
  title,
  redirectTo,
  filming = false,
  compact = false,
  className,
}: {
  id: string;
  title: string;
  /** Where to go after the video is gone. The library stays put and refreshes. */
  redirectTo?: string;
  /** An open job: filming stops and held credits come back. */
  filming?: boolean;
  /** Icon on a card. The confirm step still spells out what delete does. */
  compact?: boolean;
  className?: string;
}) => {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteVideo, { isLoading }] = useDeleteVideoMutation();
  const message = filming
    ? "Filming stops. Credits still on hold come back. This can't be undone."
    : "This removes the video from your account. This can't be undone.";

  const handleDelete = async () => {
    if (isLoading) return;
    setError(null);
    try {
      await deleteVideo(id).unwrap();
      if (redirectTo) router.push(redirectTo);
      router.refresh();
    } catch (cause) {
      if (apiErrorStatus(cause) === 401) {
        router.push(loginPath(redirectTo ?? "/videos"));
        return;
      }
      setError(apiErrorMessage(cause, "Couldn't delete the video."));
    }
  };

  const handleAsk = () => {
    setError(null);
    setConfirming(true);
  };

  const handleKeep = () => {
    setError(null);
    setConfirming(false);
  };

  if (confirming) {
    return (
      <div
        className={cn(
          "flex flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-md",
          "pointer-events-auto w-full",
          className,
        )}
        role="group"
        aria-label={`Delete ${title}`}
      >
        <p className="px-1 text-xs text-muted-foreground">{message}</p>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isLoading}
            aria-busy={isLoading}
            onClick={() => {
              void handleDelete();
            }}
          >
            {isLoading ? "Deleting…" : "Delete"}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={isLoading} onClick={handleKeep}>
            Keep
          </Button>
        </div>
        {error ? (
          <p className="px-1 text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  if (compact) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={`Delete ${title}`}
        onClick={handleAsk}
        className={cn("pointer-events-auto bg-card shadow-sm", className)}
      >
        <Trash2 aria-hidden />
      </Button>
    );
  }

  return (
    <div className={cn("pointer-events-auto flex flex-col gap-2", className)}>
      <Button type="button" variant="ghost" aria-label={`Delete ${title}`} onClick={handleAsk}>
        <Trash2 data-icon="inline-start" aria-hidden />
        Delete
      </Button>
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};
