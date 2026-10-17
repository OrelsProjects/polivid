"use client";

import { ArrowUp, Square } from "lucide-react";
import { useId } from "react";
import { MediaUpload } from "@/components/media-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CharacterPicker } from "@/components/characters/character-picker";
import type { CharacterSummary } from "@/lib/characters/types";

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
  variant = "page",
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
  /** `panel` is the composer beside the video. `page` is the full-width chat. */
  variant?: "page" | "panel";
}) {
  const hintId = useId();
  const hasContent = value.trim().length > 0 || referenceKeys.length > 0 || Boolean(mediaKey) || Boolean(videoKey);
  const canSend = hasContent && !busy && !uploading;

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
        <div className="rounded-[20px] border border-border bg-card p-3 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain">
            <MediaUpload
              kind="image"
              multiple
              compact
              mediaKeys={referenceKeys}
              onChangeKeys={onReferenceKeys}
              onBusyChange={onReferencesBusy}
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
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
              disabled={busy}
            />
          </div>
          <div className="mt-2 flex items-end gap-2">
            <Textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  if (canSend) onSend();
                }
              }}
              rows={1}
              aria-label="Message the Coach"
              aria-describedby={hintId}
              placeholder={variant === "panel" ? "Describe a change…" : "Describe the video you want…"}
              className="max-h-48 min-h-10 flex-1 resize-none border-0 bg-transparent px-1 py-2 shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
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
          {uploading
            ? "Waiting for the upload to finish…"
            : busy
              ? "The Coach is replying. You can keep typing."
              : "Press ⌘ Enter to send."}
        </p>
      </div>
    </form>
  );
}
