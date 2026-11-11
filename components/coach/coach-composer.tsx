"use client";

import { ArrowUp, Sparkles, Square } from "lucide-react";
import { useId } from "react";
import { MediaUpload } from "@/components/media-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CharacterPicker } from "@/components/characters/character-picker";
import type { CharacterSummary } from "@/lib/characters/types";
import { cn } from "@/lib/utils";

export function CoachComposer({
  value,
  onChange,
  onSend,
  onStop,
  busy = false,
  uploading = false,
  referenceKeys,
  onReferenceKeys,
  onReferencesBusy,
  mediaKey,
  onMediaKey,
  videoKey,
  onVideoKey,
  characterId,
  onCharacterId,
  onCharacterName,
  characters,
  runWild = false,
  onRunWild,
  variant = "page",
  disabled = false,
  filming = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  /** The Coach is replying. Typing stays open; sending waits. */
  busy?: boolean;
  /** An attachment is still uploading. */
  uploading?: boolean;
  referenceKeys: string[];
  onReferenceKeys: (keys: string[]) => void;
  onReferencesBusy: (busy: boolean) => void;
  mediaKey: string | null;
  onMediaKey: (key: string | null) => void;
  videoKey: string | null;
  onVideoKey: (key: string | null) => void;
  characterId: string;
  onCharacterId: (value: string) => void;
  onCharacterName: (name: string) => void;
  characters?: CharacterSummary[];
  /** Skip questions and the storyboard. The Coach decides and starts the video. */
  runWild?: boolean;
  onRunWild?: (on: boolean) => void;
  /** `panel` is the composer beside the video. `page` is the full-width chat. */
  variant?: "page" | "panel";
  /** A video is being made. The composer waits until that job finishes. */
  disabled?: boolean;
  /** A video is queued or filming. Chat stays open. Changes wait. */
  filming?: boolean;
}) {
  const hintId = useId();
  const hasContent = value.trim().length > 0 || referenceKeys.length > 0 || Boolean(mediaKey) || Boolean(videoKey);
  const locked = busy || disabled;
  const canSend = hasContent && !locked && !uploading;

  return (
    <form
      className={
        variant === "panel"
          ? "shrink-0 px-3 pt-2 pb-3"
          : "shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
      }
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <div className={variant === "panel" ? "flex w-full flex-col" : "mx-auto flex w-full max-w-3xl flex-col"}>
        <div
          className={cn(
            "rounded-[20px] border border-border bg-card p-3",
            disabled
              ? "opacity-50 [&_button:disabled]:opacity-100"
              : "transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          )}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <MediaUpload
              kind="image"
              multiple
              compact
              mediaKeys={referenceKeys}
              onChangeKeys={onReferenceKeys}
              onBusyChange={onReferencesBusy}
              disabled={locked}
              label="Reference pictures"
              hint="Optional. A photo of the singer, or a look to match."
              librarySide="top"
            />
            <MediaUpload
              kind="audio"
              compact
              compactLabel="Song"
              mediaKey={mediaKey}
              onChange={onMediaKey}
              onBusyChange={onReferencesBusy}
              disabled={locked}
              label="Song"
              hint="MP3 or WAV for a music video."
              librarySide="top"
            />
            <MediaUpload
              kind="video"
              compact
              compactLabel="Video"
              mediaKey={videoKey}
              onChange={onVideoKey}
              onBusyChange={onReferencesBusy}
              disabled={locked}
              label="Video"
              hint="MP4 or WebM to caption or cut."
              librarySide="top"
            />
            <CharacterPicker
              compact
              value={characterId}
              onChange={onCharacterId}
              onSelectCharacter={(character) => onCharacterName(character?.name ?? "")}
              offLabel="No character"
              characters={characters}
              disabled={locked}
            />
            <TooltipProvider delay={400}>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  aria-pressed={runWild}
                  disabled={locked || !onRunWild}
                  onClick={() => onRunWild?.(!runWild)}
                  className={cn(
                    "inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed px-3 text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                    runWild
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Sparkles className="size-4 shrink-0" aria-hidden />
                  Run wild
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  align="start"
                  sideOffset={6}
                  showArrow={false}
                  className="block max-w-64 border border-white/15 bg-[#25252a] text-left leading-snug text-[#e9e9e9]"
                >
                  Skip the questions and the storyboard. The Coach decides and starts the video.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="mt-2 flex items-end gap-2">
            <Textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.key !== "Enter") return;
                if (event.metaKey || event.ctrlKey) {
                  event.preventDefault();
                  const field = event.currentTarget;
                  const start = field.selectionStart ?? value.length;
                  const end = field.selectionEnd ?? value.length;
                  onChange(`${value.slice(0, start)}\n${value.slice(end)}`);
                  const cursor = start + 1;
                  requestAnimationFrame(() => {
                    field.selectionStart = cursor;
                    field.selectionEnd = cursor;
                  });
                  return;
                }
                if (event.shiftKey) return;
                event.preventDefault();
                if (canSend) onSend();
              }}
              rows={1}
              disabled={disabled}
              aria-label="Message the Coach"
              aria-describedby={hintId}
              placeholder={variant === "panel" ? "Describe a change…" : "Describe the video you want…"}
              className="max-h-48 min-h-10 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:border-transparent focus-visible:ring-0 disabled:cursor-not-allowed disabled:bg-transparent disabled:opacity-100 dark:bg-transparent dark:disabled:bg-transparent"
            />
            {busy && onStop ? (
              <Button
                type="button"
                variant="outline"
                onClick={onStop}
                aria-label="Stop the reply"
                className="size-11 shrink-0 rounded-full"
              >
                <Square aria-hidden className="size-4 fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!canSend}
                aria-label="Send message"
                className="size-11 shrink-0 rounded-full"
              >
                <ArrowUp aria-hidden className="size-5" />
              </Button>
            )}
          </div>
        </div>
        <p id={hintId} className="mt-2 text-center text-xs text-muted-foreground">
          {filming
            ? "You can chat. Changes are only available when this video finishes or you stop it."
            : disabled
              ? "The video is still being made."
              : uploading
              ? "Waiting for the upload to finish…"
              : busy
                ? "The Coach is replying. You can keep typing."
                : "Enter to send. ⌘ Enter for a new line."}
        </p>
      </div>
    </form>
  );
}
