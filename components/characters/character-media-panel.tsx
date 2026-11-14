"use client";

import { Film, ImagePlus, LoaderCircle, Mic, Plus, Scissors, Star, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { clipDuration, extractSharpFrames, extractVoiceWav } from "@/lib/characters/clip-tools";
import {
  MAX_CHARACTER_CLIPS,
  MAX_CHARACTER_IMAGES,
  MAX_CLIP_SECONDS,
  MAX_LOOK_NAME,
  MAX_WARDROBE,
  MEDIA_LABEL_NAMES,
  MEDIA_LABELS,
  type CharacterMediaItem,
} from "@/lib/characters/media";
import type { CharacterSummary } from "@/lib/characters/types";
import { apiErrorMessage } from "@/lib/store/api-errors";
import {
  useAddCharacterLookMutation,
  useAddCharacterMediaMutation,
  useRemoveCharacterLookMutation,
  useRemoveCharacterMediaMutation,
  useUpdateCharacterLookMutation,
  useUpdateCharacterMediaMutation,
  useVoiceFromClipMutation,
  type CharacterMediaAdd,
} from "@/lib/store/endpoints/characters";
import { useUploadFileMutation } from "@/lib/store/endpoints/uploads";
import { cn } from "@/lib/utils";

const FIELD =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/**
 * A saved character's library: pictures and clips with labels and looks, plus clip tools
 * (pull the sharpest frames, build the voice from a clip's sound).
 */
export function CharacterMediaPanel({ character }: { character: CharacterSummary }) {
  const [upload] = useUploadFileMutation();
  const [addMedia] = useAddCharacterMediaMutation();
  const [updateMedia] = useUpdateCharacterMediaMutation();
  const [removeMedia] = useRemoveCharacterMediaMutation();
  const [addLook, { isLoading: addingLook }] = useAddCharacterLookMutation();
  const [updateLook] = useUpdateCharacterLookMutation();
  const [removeLook] = useRemoveCharacterLookMutation();
  const [voiceFromClip] = useVoiceFromClipMutation();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lookName, setLookName] = useState("");
  const [lookWardrobe, setLookWardrobe] = useState("");
  const [voiceClip, setVoiceClip] = useState<CharacterMediaItem | null>(null);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const images = character.media.filter((item) => item.kind === "image");
  const clips = character.media.filter((item) => item.kind === "video");

  const run = async (label: string, work: () => Promise<string | void>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const message = await work();
      if (message) setNotice(message);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : apiErrorMessage(cause, "That didn't work."));
    } finally {
      setBusy(null);
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    void run("upload", async () => {
      const items: CharacterMediaAdd[] = [];
      for (const file of Array.from(files)) {
        if (IMAGE_TYPES.includes(file.type)) {
          items.push({ key: await upload(file).unwrap(), label: "other" });
        } else if (VIDEO_TYPES.includes(file.type)) {
          const seconds = await clipDuration(file).catch(() => 0);
          if (seconds > MAX_CLIP_SECONDS + 0.5) {
            throw new Error(`${file.name} is ${Math.round(seconds)} seconds. Keep clips to ${MAX_CLIP_SECONDS} seconds or less.`);
          }
          items.push({ key: await upload(file).unwrap(), label: "other", durationSec: seconds || undefined });
        } else {
          throw new Error(`${file.name}: use JPEG, PNG, or WebP pictures, or MP4, WebM, or MOV clips.`);
        }
      }
      await addMedia({ id: character.id, items }).unwrap();
      return `Added ${items.length} ${items.length === 1 ? "file" : "files"}. Label each picture so the best ones are sent first.`;
    });
    if (fileInput.current) fileInput.current.value = "";
  };

  const pullFrames = (clip: CharacterMediaItem) =>
    run(`frames:${clip.id}`, async () => {
      const frames = await extractSharpFrames(clip.url, 4);
      if (frames.length === 0) throw new Error("Couldn't find a sharp frame in that clip.");
      const items: CharacterMediaAdd[] = [];
      for (const [index, frame] of frames.entries()) {
        const file = new File([frame.blob], `frame-${index + 1}.jpg`, { type: "image/jpeg" });
        items.push({
          key: await upload(file).unwrap(),
          label: "other",
          lookId: clip.lookId,
          sourceMediaId: clip.id,
          caption: `Frame at ${frame.time.toFixed(1)}s`,
        });
      }
      await addMedia({ id: character.id, items }).unwrap();
      return `Added ${items.length} frames from the clip. Label the good ones and remove any that aren't clear.`;
    });

  const buildVoice = () => {
    const clip = voiceClip;
    if (!clip || !voiceConsent) return;
    void run(`voice:${clip.id}`, async () => {
      const wav = await extractVoiceWav(clip.url);
      await voiceFromClip({ id: character.id, samples: [wav] }).unwrap();
      setVoiceClip(null);
      setVoiceConsent(false);
      return "Built the voice from that clip. Preview it on the character card.";
    });
  };

  const looks = character.looks;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Pictures, clips, and looks</h2>
        <p className="text-sm text-muted-foreground">
          More angles keep the face consistent. Videos send up to 4 pictures, face first; the starred picture always leads.
          Clips can supply extra frames, the voice, and a motion reference for models that take video.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">Looks</h3>
          <span className="text-xs text-muted-foreground">Outfits or styles a video can pick</span>
        </div>
        {looks.map((look) => (
          <div key={look.id} className="flex flex-col gap-2 rounded-xl border border-border p-3 sm:flex-row sm:items-center">
            <input
              defaultValue={look.name}
              maxLength={MAX_LOOK_NAME}
              aria-label="Look name"
              className={cn(FIELD, "sm:w-40")}
              onBlur={(event) => {
                const name = event.target.value.trim();
                if (name && name !== look.name) void run("look", async () => void (await updateLook({ id: character.id, lookId: look.id, name }).unwrap()));
              }}
            />
            <input
              defaultValue={look.wardrobe ?? ""}
              maxLength={MAX_WARDROBE}
              placeholder="What they wear, e.g. navy blazer, white shirt"
              aria-label="Wardrobe"
              className={FIELD}
              onBlur={(event) => {
                const wardrobe = event.target.value.trim();
                if (wardrobe !== (look.wardrobe ?? "")) {
                  void run("look", async () => void (await updateLook({ id: character.id, lookId: look.id, wardrobe }).unwrap()));
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove the ${look.name} look`}
              disabled={busy !== null}
              onClick={() => void run("look", async () => void (await removeLook({ id: character.id, lookId: look.id }).unwrap()))}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
        ))}
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (lookName.trim().length < 2) return;
            void run("look", async () => {
              await addLook({ id: character.id, name: lookName.trim(), wardrobe: lookWardrobe.trim() || undefined }).unwrap();
              setLookName("");
              setLookWardrobe("");
            });
          }}
        >
          <input
            value={lookName}
            onChange={(event) => setLookName(event.target.value)}
            maxLength={MAX_LOOK_NAME}
            placeholder="New look, e.g. Office"
            aria-label="New look name"
            className={cn(FIELD, "sm:w-40")}
          />
          <input
            value={lookWardrobe}
            onChange={(event) => setLookWardrobe(event.target.value)}
            maxLength={MAX_WARDROBE}
            placeholder="Wardrobe (optional)"
            aria-label="New look wardrobe"
            className={FIELD}
          />
          <Button type="submit" variant="outline" disabled={addingLook || lookName.trim().length < 2}>
            <Plus aria-hidden data-icon="inline-start" />
            Add look
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-medium">
            Library{" "}
            <span className="font-normal text-muted-foreground">
              {images.length}/{MAX_CHARACTER_IMAGES} pictures · {clips.length}/{MAX_CHARACTER_CLIPS} clips
            </span>
          </h3>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={[...IMAGE_TYPES, ...VIDEO_TYPES].join(",")}
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
          <Button type="button" variant="outline" disabled={busy !== null} onClick={() => fileInput.current?.click()}>
            {busy === "upload" ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden /> : <ImagePlus data-icon="inline-start" aria-hidden />}
            {busy === "upload" ? "Uploading…" : "Add pictures or clips"}
          </Button>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {character.media.map((item) => {
            const main = item.kind === "image" && item.key === character.imageKey;
            return (
              <li key={item.id} className={cn("flex flex-col gap-2 rounded-xl border p-2", main ? "border-primary" : "border-border")}>
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {item.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private upload preview
                    <img src={item.url} alt={item.caption ?? MEDIA_LABEL_NAMES[item.label]} className="size-full object-cover" loading="lazy" />
                  ) : (
                    <video src={item.url} className="size-full object-cover" muted playsInline preload="metadata" controls />
                  )}
                  {main ? (
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">Main</span>
                  ) : null}
                  {item.kind === "video" ? (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[11px] text-white">
                      <Film className="size-3" aria-hidden />
                      {item.durationSec ? `${Math.round(item.durationSec)}s` : "Clip"}
                    </span>
                  ) : null}
                </div>
                {item.kind === "image" ? (
                  <select
                    value={item.label}
                    aria-label="What the picture shows"
                    className={FIELD}
                    disabled={busy !== null}
                    onChange={(event) =>
                      void run("media", async () => void (await updateMedia({ id: character.id, mediaId: item.id, label: event.target.value }).unwrap()))
                    }
                  >
                    {MEDIA_LABELS.map((label) => (
                      <option key={label} value={label}>
                        {MEDIA_LABEL_NAMES[label]}
                      </option>
                    ))}
                  </select>
                ) : null}
                {looks.length > 0 ? (
                  <select
                    value={item.lookId ?? ""}
                    aria-label="Look"
                    className={FIELD}
                    disabled={busy !== null}
                    onChange={(event) =>
                      void run("media", async () =>
                        void (await updateMedia({ id: character.id, mediaId: item.id, lookId: event.target.value || null }).unwrap()),
                      )
                    }
                  >
                    <option value="">Any look</option>
                    {looks.map((look) => (
                      <option key={look.id} value={look.id}>
                        {look.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <div className="flex flex-wrap gap-1">
                  {item.kind === "image" && !main ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Make this the main picture"
                      disabled={busy !== null}
                      onClick={() => void run("media", async () => void (await updateMedia({ id: character.id, mediaId: item.id, main: true }).unwrap()))}
                    >
                      <Star aria-hidden />
                    </Button>
                  ) : null}
                  {item.kind === "video" ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => void pullFrames(item)}
                        title="Add the 4 sharpest frames as pictures"
                      >
                        {busy === `frames:${item.id}` ? <LoaderCircle className="animate-spin" aria-hidden /> : <Scissors aria-hidden />}
                        Frames
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy !== null}
                        onClick={() => {
                          setVoiceClip(item);
                          setVoiceConsent(false);
                        }}
                        title="Build the character's voice from this clip's sound"
                      >
                        <Mic aria-hidden />
                        Voice
                      </Button>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove from the character"
                    className="ml-auto"
                    disabled={busy !== null}
                    onClick={() => void run("media", async () => void (await removeMedia({ id: character.id, mediaId: item.id }).unwrap()))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {voiceClip ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-sm font-medium">Build the voice from this clip</p>
          <p className="text-sm text-muted-foreground">
            Uses up to 30 seconds of the clip&apos;s sound and replaces the character&apos;s current voice. A clip with only them
            talking, and no music, works best.
          </p>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={voiceConsent}
              onChange={(event) => setVoiceConsent(event.target.checked)}
              className="mt-0.5 size-4 accent-primary"
            />
            <span>This is my own voice, and I can use it on videos I make here.</span>
          </label>
          <div className="flex gap-2">
            <Button type="button" disabled={!voiceConsent || busy !== null} onClick={buildVoice}>
              {busy?.startsWith("voice:") ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
              {busy?.startsWith("voice:") ? "Building…" : "Build voice"}
            </Button>
            <Button type="button" variant="ghost" disabled={busy !== null} onClick={() => setVoiceClip(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {busy === "media" || busy === "look" ? <p className="text-xs text-muted-foreground">Saving…</p> : null}
      {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
