"use client";

import { ChevronDown, Download, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { saveBlob, saveLink, videoToGif, videoToWav } from "@/lib/media/convert-in-browser";
import { DOWNLOAD_FORMAT_LABELS, DOWNLOAD_FORMATS, downloadName, MAX_GIF_SECONDS, type DownloadFormat } from "@/lib/media/download-formats";
import { cn } from "@/lib/utils";

/**
 * "Download ▾" with MP4, GIF, and WAV. MP4 is the file itself; GIF and WAV are made in the browser from it.
 * `src` is the video file (same origin), `title` names the download.
 */
export function DownloadAsMenu({
  src,
  title,
  size = "sm",
  className,
}: {
  src: string;
  title: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const [working, setWorking] = useState<{ format: DownloadFormat; share: number } | null>(null);
  const [message, setMessage] = useState<{ tone: "note" | "error"; text: string } | null>(null);

  const download = async (format: DownloadFormat) => {
    if (working) return;
    setMessage(null);
    const name = downloadName(title, format);
    if (format === "mp4") {
      saveLink(`${src}${src.includes("?") ? "&" : "?"}download=1&name=${encodeURIComponent(name)}`, name);
      return;
    }
    setWorking({ format, share: 0 });
    try {
      if (format === "wav") {
        saveBlob(await videoToWav(src), name);
      } else {
        const gif = await videoToGif(src, (share) => setWorking({ format, share }));
        saveBlob(gif.blob, name);
        if (gif.trimmed) setMessage({ tone: "note", text: `The GIF has the first ${MAX_GIF_SECONDS} seconds.` });
      }
    } catch (cause) {
      setMessage({ tone: "error", text: cause instanceof Error ? cause.message : "Couldn't make that file." });
    } finally {
      setWorking(null);
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={working !== null}
          aria-label="Download as"
          className={cn(buttonVariants({ size }), "w-full cursor-pointer disabled:cursor-wait", size === "lg" && "h-12 rounded-xl")}
        >
          {working ? (
            <>
              <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden />
              {working.format === "gif" ? `Making GIF… ${Math.round(working.share * 100)}%` : "Saving the sound…"}
            </>
          ) : (
            <>
              <Download data-icon="inline-start" aria-hidden />
              Download
              <ChevronDown data-icon="inline-end" aria-hidden />
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 p-1.5">
          {DOWNLOAD_FORMATS.map((format) => (
            <DropdownMenuItem key={format} onClick={() => void download(format)} className="flex flex-col items-start gap-0 px-2 py-1.5">
              <span className="text-sm font-medium">{DOWNLOAD_FORMAT_LABELS[format].title}</span>
              <span className="text-xs text-muted-foreground">{DOWNLOAD_FORMAT_LABELS[format].detail}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {message ? (
        <p className={cn("text-xs", message.tone === "error" ? "text-destructive" : "text-muted-foreground")} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
