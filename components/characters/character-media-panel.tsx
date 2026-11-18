"use client";

import { Film, ImagePlus, LoaderCircle, Maximize2, Mic, Plus, Scissors, Star, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/audio-player";
import { Button } from "@/components/ui/button";
import { VoiceUploadAgreement } from "./voice-upload-agreement";
import { clipDuration, extractSharpFrames, extractVoiceWav, VOICE_SAMPLE_RATE } from "@/lib/characters/clip-tools";
import { MAX_VOICE_FILES, MAX_VOICE_TOTAL_SECONDS } from "@/lib/voice/constants";
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
import { MIN_PICTURE_SIDE, pictureSizeProblem, readPictureSize, rescalePicture, SMALL_PICTURE_SIDE, type PictureSize } from "@/lib/characters/picture-size";
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

/** Where a voice recording comes from: one of the character's clips, or a file picked just for the voice. */
type VoiceSource = { clip: CharacterMediaItem } | { file: File };
type VoiceSample = { id: string; name: string; seconds: number; blob: Blob; url: string };

/** A recording shorter than this can't be used, so a nearly full list takes no more. */
const MIN_VOICE_SAMPLE_SECONDS = 3;
/** Header bytes before the samples in the WAV that extractVoiceWav writes. */
const WAV_HEADER_BYTES = 44;

/** Seconds of 16-bit mono sound in a WAV made by extractVoiceWav. */
const wavSeconds = (wav: Blob) => Math.max(0, wav.size - WAV_HEADER_BYTES) / (VOICE_SAMPLE_RATE * 2);

const clock = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/**
 * A saved character's library: pictures and clips with labels and looks, plus clip tools
 * (pull the sharpest frames, build the voice from a clip's sound).
 */
export function CharacterMediaPanel({ character, onVoiceSaved }: {
  character: CharacterSummary;
  onVoiceSaved?: (character: CharacterSummary) => void;
}) {
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
  /** The recordings the voice will be built from: the character's clips or files picked for the voice. */
  const [voiceSamples, setVoiceSamples] = useState<VoiceSample[]>([]);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [agreementOpen, setAgreementOpen] = useState(false);
  /** Each picture's real size, read when its preview loads. */
  const [sizes, setSizes] = useState<Record<string, PictureSize>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const voiceInput = useRef<HTMLInputElement>(null);
  const sampleRequest = useRef(0);

  /** The same list as voiceSamples, updated first, so a run adding several files sees the ones it already added. */
  const samplesRef = useRef<VoiceSample[]>([]);

  useEffect(() => () => {
    sampleRequest.current += 1;
    for (const sample of samplesRef.current) URL.revokeObjectURL(sample.url);
  }, []);

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
      let small = 0;
      for (const file of Array.from(files)) {
        if (IMAGE_TYPES.includes(file.type)) {
          if (pictureSizeProblem((await readPictureSize(file)) ?? undefined)) small += 1;
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
      const added = `Added ${items.length} ${items.length === 1 ? "file" : "files"}. Label each picture so the best ones are sent first.`;
      if (small === 0) return added;
      return `${added} ${small === 1 ? "One picture is" : `${small} pictures are`} under ${SMALL_PICTURE_SIDE} pixels and will look soft in videos. Rescale ${small === 1 ? "it" : "them"} below, or upload a bigger version.`;
    });
    if (fileInput.current) fileInput.current.value = "";
  };

  /** Swap a small picture for an upscaled copy, keeping its label, look, caption, and main star. */
  const rescale = (item: CharacterMediaItem) =>
    run(`rescale:${item.id}`, async () => {
      const main = item.key === character.imageKey;
      const file = await rescalePicture(item.url, "rescaled.jpg");
      const key = await upload(file).unwrap();
      const saved = await addMedia({
        id: character.id,
        items: [{ key, label: item.label, lookId: item.lookId, caption: item.caption ?? undefined, sourceMediaId: item.sourceMediaId ?? undefined }],
      }).unwrap();
      const copy = saved.media.find((media) => media.key === key);
      if (!copy) throw new Error("Rescaled the picture but couldn't find the copy. Refresh and try again.");
      if (main) await updateMedia({ id: character.id, mediaId: copy.id, main: true }).unwrap();
      await removeMedia({ id: character.id, mediaId: item.id }).unwrap();
      return "Rescaled the picture. A sharper original will still look better.";
    });

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

  /**
   * Takes the sound of each recording in the browser and adds it to the list, within the file and
   * time limits. A file that can't be used is named in the error; the rest are still added.
   */
  const addVoiceSources = (sources: VoiceSource[]) => {
    setVoiceOpen(true);
    setAgreementOpen(false);
    const request = sampleRequest.current;
    void run("sample", async () => {
      const problems: string[] = [];
      let skipped = 0;
      for (const source of sources) {
        if (request !== sampleRequest.current) return;
        const current = samplesRef.current;
        const remaining = MAX_VOICE_TOTAL_SECONDS - current.reduce((sum, sample) => sum + sample.seconds, 0);
        if (current.length >= MAX_VOICE_FILES || remaining < MIN_VOICE_SAMPLE_SECONDS) {
          skipped += 1;
          continue;
        }
        const name = "clip" in source ? source.clip.caption ?? "Clip" : source.file.name;
        try {
          const blob = await extractVoiceWav("clip" in source ? source.clip.url : source.file, remaining);
          if (request !== sampleRequest.current) return;
          const sample = { id: crypto.randomUUID(), name, seconds: wavSeconds(blob), blob, url: URL.createObjectURL(blob) };
          samplesRef.current = [...samplesRef.current, sample];
          setVoiceSamples(samplesRef.current);
        } catch (cause) {
          problems.push(`${name}: ${cause instanceof Error ? cause.message : "couldn't read its sound."}`);
        }
      }
      if (skipped > 0) {
        problems.push(
          `${skipped === 1 ? "One recording wasn't" : `${skipped} recordings weren't`} added: the limit is ${MAX_VOICE_FILES} recordings and ${MAX_VOICE_TOTAL_SECONDS / 60} minutes in total.`,
        );
      }
      if (problems.length > 0) throw new Error(problems.join(" "));
    });
  };

  const removeVoiceSample = (id: string) => {
    const sample = samplesRef.current.find((item) => item.id === id);
    if (sample) URL.revokeObjectURL(sample.url);
    samplesRef.current = samplesRef.current.filter((item) => item.id !== id);
    setVoiceSamples(samplesRef.current);
  };

  const closeVoice = () => {
    sampleRequest.current += 1;
    for (const sample of samplesRef.current) URL.revokeObjectURL(sample.url);
    samplesRef.current = [];
    setVoiceSamples([]);
    setVoiceOpen(false);
    setAgreementOpen(false);
  };

  const buildVoice = () => {
    if (voiceSamples.length === 0 || busy !== null) return;
    setAgreementOpen(false);
    void run("voice", async () => {
      const saved = await voiceFromClip({ id: character.id, samples: voiceSamples.map((sample) => sample.blob), consent: true }).unwrap();
      onVoiceSaved?.(saved);
      closeVoice();
      return "Built the voice. Preview it on the character card.";
    });
  };

  const pickVoiceFiles = (files: FileList | null) => {
    const picked = Array.from(files ?? []);
    if (voiceInput.current) voiceInput.current.value = "";
    if (picked.length === 0) return;
    const usable = picked.filter((file) => file.type.startsWith("audio/") || file.type.startsWith("video/"));
    if (usable.length < picked.length) {
      setError("Some files were skipped. Pick audio files (MP3, M4A, WAV) or videos with them talking.");
    } else {
      setError(null);
    }
    if (usable.length > 0) addVoiceSources(usable.map((file) => ({ file })));
  };

  const voiceSeconds = voiceSamples.reduce((sum, sample) => sum + sample.seconds, 0);
  const voiceFull = voiceSamples.length >= MAX_VOICE_FILES || MAX_VOICE_TOTAL_SECONDS - voiceSeconds < MIN_VOICE_SAMPLE_SECONDS;

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
            const size = item.kind === "image" ? sizes[item.id] : undefined;
            const sizeProblem = pictureSizeProblem(size);
            return (
              <li key={item.id} className={cn("flex flex-col gap-2 rounded-xl border p-2", main ? "border-primary" : "border-border")}>
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {item.kind === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private upload preview
                    <img
                      src={item.url}
                      alt={item.caption ?? MEDIA_LABEL_NAMES[item.label]}
                      className="size-full object-cover"
                      loading="lazy"
                      onLoad={(event) => {
                        const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
                        if (width && height) setSizes((current) => (current[item.id] ? current : { ...current, [item.id]: { width, height } }));
                      }}
                    />
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
                  {size && sizeProblem ? (
                    <span
                      className={cn(
                        "absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white",
                        sizeProblem === "tooSmall" ? "bg-red-600" : "bg-amber-600",
                      )}
                    >
                      <TriangleAlert className="size-3" aria-hidden />
                      {size.width}×{size.height}
                    </span>
                  ) : null}
                </div>
                {sizeProblem ? (
                  <div
                    className={cn(
                      "flex flex-col gap-1.5 rounded-lg px-2 py-1.5 text-xs",
                      sizeProblem === "tooSmall" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                    )}
                  >
                    <p>
                      {sizeProblem === "tooSmall"
                        ? `Under ${MIN_PICTURE_SIDE} pixels. Character swaps will fail with this picture.`
                        : `Under ${SMALL_PICTURE_SIDE} pixels. The face may look soft.`}
                    </p>
                    <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void rescale(item)}>
                      {busy === `rescale:${item.id}` ? <LoaderCircle className="animate-spin" aria-hidden /> : <Maximize2 aria-hidden />}
                      {busy === `rescale:${item.id}` ? "Rescaling…" : "Rescale"}
                    </Button>
                  </div>
                ) : null}
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
                        onClick={() => addVoiceSources([{ clip: item }])}
                        title="Use this clip's sound for the character's voice"
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

      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-medium">Voice from recordings</h3>
            <p className="text-xs text-muted-foreground">
              Upload MP3, M4A, WAV, or MP4 files with one speaker you have permission to clone. Pick several at once, up to{" "}
              {MAX_VOICE_FILES}. One to two minutes of clear speech in total works best.
            </p>
          </div>
          <input
            ref={voiceInput}
            type="file"
            multiple
            accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/x-wav,audio/aac,audio/ogg,audio/webm,video/mp4,video/quicktime,video/webm"
            className="hidden"
            onChange={(event) => pickVoiceFiles(event.target.files)}
          />
          <Button type="button" variant="outline" disabled={busy !== null || voiceFull} onClick={() => voiceInput.current?.click()}>
            <Mic aria-hidden data-icon="inline-start" />
            {voiceSamples.length > 0 ? "Add recordings" : "Upload recordings"}
          </Button>
        </div>
      </div>

      {voiceOpen ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium">
              {voiceSamples.length === 0
                ? "Build the voice"
                : `Build the voice from ${voiceSamples.length} ${voiceSamples.length === 1 ? "recording" : "recordings"}`}
            </p>
            <span className="text-xs text-muted-foreground tabular-nums">
              {clock(voiceSeconds)} of {clock(MAX_VOICE_TOTAL_SECONDS)} · {voiceSamples.length}/{MAX_VOICE_FILES} recordings
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            The sound is taken in your browser, and the new voice replaces the character&apos;s current one. Only them talking,
            with no music, works best.
          </p>
          {voiceSamples.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {voiceSamples.map((sample) => (
                <li key={sample.id} className="flex flex-col gap-1.5 rounded-lg border border-border bg-background p-2">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm">{sample.name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{clock(sample.seconds)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${sample.name}`}
                      disabled={busy !== null}
                      onClick={() => removeVoiceSample(sample.id)}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </div>
                  <AudioPlayer src={sample.url} title={`Voice sample: ${sample.name}`} />
                </li>
              ))}
            </ul>
          ) : null}
          {busy === "sample" ? (
            <p className="text-sm text-muted-foreground" role="status">
              Preparing the audio…
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={voiceSamples.length === 0 || busy !== null} onClick={() => setAgreementOpen(true)}>
              {busy === "voice" ? <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
              {busy === "voice" ? "Building…" : "Build voice"}
            </Button>
            <Button type="button" variant="outline" disabled={busy !== null || voiceFull} onClick={() => voiceInput.current?.click()}>
              <Plus aria-hidden data-icon="inline-start" />
              Add more
            </Button>
            <Button type="button" variant="ghost" disabled={busy === "voice"} onClick={closeVoice}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {agreementOpen ? <VoiceUploadAgreement onClose={() => setAgreementOpen(false)} onConfirm={buildVoice} /> : null}

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
