"use client";

import {
  ArrowRight,
  LoaderCircle,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { UpgradeDialog } from "@/components/billing/upgrade-dialog";
import { MediaUpload } from "@/components/media-upload";
import { ModelPicker } from "@/components/model-picker";
import { TierPicker } from "@/components/tier-picker";
import { PresetPicker } from "@/components/preset-picker";
import { PreviewSample, StylePoster } from "@/components/style-frame";
import { VisualDirectionField } from "@/components/visual-direction-field";
import { CharacterPicker } from "@/components/characters/character-picker";
import { SongTakeStep } from "@/components/song-take-step";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { videoJobCredits } from "@/lib/billing/estimate";
import { apiErrorMessage, apiErrorStatus, insufficientCredits, loginPath } from "@/lib/store/api-errors";
import { useGetCreditsQuery } from "@/lib/store/endpoints/billing";
import { useGetPresetsQuery } from "@/lib/store/endpoints/presets";
import {
  useCreateVideoMutation,
  useImprovePromptMutation,
  type SongTake,
  type SongTakeBody,
} from "@/lib/store/endpoints/videos";
import { cn } from "@/lib/utils";
import { clearCreateDraft, readCreateDraft, writeCreateDraft } from "@/lib/video/create-draft";
import { generationModelById, generationModelBySlug, type GenerationModelId } from "@/lib/video/models";
import {
  isVideoTier,
  modeAcceptsReferenceImages,
  modeNeedsUpload,
  resolveModeTier,
  videoModeById,
  type VideoModeId,
  type VideoTier,
} from "@/lib/video/modes";
import { formatClipSplit, isStitchedMode, planSegments } from "@/lib/video/segments";
import { isVideoLength, MAX_PROMPT_LENGTH, MAX_VIDEO_LENGTH, MIN_VIDEO_LENGTH, type VideoFormat } from "@/lib/video/schema";
import { AUTO_PRESET_ID, defaultPresetIdFor } from "@/lib/video/presets";
import { defaultCharacterForMode, modeCanNarrate, OFF_VOICE_ID } from "@/lib/voice/constants";

const FORMATS: { value: VideoFormat; label: string; hint: string; icon: typeof Square }[] = [
  { value: "9:16", label: "Vertical", hint: "Shorts, TikTok, Reels", icon: RectangleVertical },
  { value: "1:1", label: "Square", hint: "Feeds, LinkedIn", icon: Square },
  { value: "16:9", label: "Wide", hint: "YouTube, Substack", icon: RectangleHorizontal },
];

const INPUTS = [
  { id: "topic", label: "Topic" },
  { id: "article", label: "Paste text" },
  { id: "data", label: "Data story" },
] as const;

type InputMode = (typeof INPUTS)[number]["id"];

const PLACEHOLDERS: Record<InputMode, string> = {
  topic: "Why sleep matters for memory. Three things that happen while you're out cold, for a general audience.",
  article: "Paste a newsletter, post, or notes. Mention the audience and the angle.",
  data: "Describe the data story. Name the figures you want on screen. Numbers still have to come from a source.",
};

const LENGTH_CHOICES = [30, 60, 90] as const;
const DEFAULT_CUSTOM_LENGTH = 5;

type Status = { state: "idle" } | { state: "failed"; error: string; videoId: string | null };

const isFormat = (value: string | null): value is VideoFormat =>
  value === "9:16" || value === "1:1" || value === "16:9";

const isInput = (value: string | null): value is InputMode =>
  value === "topic" || value === "article" || value === "data";

export function Generator({
  demo,
  defaultModel,
  models,
  mode,
}: {
  demo: boolean;
  defaultModel: GenerationModelId;
  /** Models this server can film with. */
  models: GenerationModelId[];
  mode?: VideoModeId;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get("prompt") ?? "";
  const requestedStyle = searchParams.get("style");
  const inputParam = searchParams.get("input");
  const formatParam = searchParams.get("format");
  const lengthParam = Number(searchParams.get("length"));
  const lengthFromUrl = isVideoLength(lengthParam);
  const presetFromUrl = lengthFromUrl && (LENGTH_CHOICES as readonly number[]).includes(lengthParam);
  const modelParam = searchParams.get("model");
  const requestedModel = modelParam
    ? (generationModelById(modelParam)?.id ?? generationModelBySlug(modelParam)?.id ?? null)
    : null;
  const modelFromUrl = requestedModel && models.includes(requestedModel) ? requestedModel : null;
  const videoMode = mode ? videoModeById(mode) : null;
  const tierParam = searchParams.get("tier");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [inputMode, setInputMode] = useState<InputMode>(isInput(inputParam) ? inputParam : "topic");
  const [format, setFormat] = useState<VideoFormat>(isFormat(formatParam) ? formatParam : "9:16");
  const [length, setLength] = useState(lengthFromUrl ? lengthParam : DEFAULT_CUSTOM_LENGTH);
  const [customLength, setCustomLength] = useState(
    presetFromUrl ? "" : String(lengthFromUrl ? lengthParam : DEFAULT_CUSTOM_LENGTH),
  );
  const [model, setModel] = useState<GenerationModelId>(modelFromUrl ?? defaultModel);
  const [tier, setTier] = useState<VideoTier>(tierParam && isVideoTier(tierParam) ? tierParam : "pro");
  const [mediaKey, setMediaKey] = useState<string | null>(null);
  const [referenceKeys, setReferenceKeys] = useState<string[]>([]);
  const [showText, setShowText] = useState(true);
  const presetEngine = videoMode?.engine === "motion" ? "motion" : "footage";
  const [presetId, setPresetId] = useState(videoMode?.engine === "motion" ? defaultPresetIdFor("motion") : AUTO_PRESET_ID);
  const [visualDirection, setVisualDirection] = useState("");
  const canNarrate = modeCanNarrate(videoMode?.id);
  const [characterId, setCharacterId] = useState(defaultCharacterForMode(videoMode?.id));
  const { data: customPresets } = useGetPresetsQuery();
  const { data: creditBalance = null } = useGetCreditsQuery();
  const [createVideo, { isLoading: submitting }] = useCreateVideoMutation();
  const [improvePrompt, { isLoading: improving }] = useImprovePromptMutation();
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [improveError, setImproveError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const [upgrade, setUpgrade] = useState<{ required: number; balance: number } | null>(null);
  const busy = improving || submitting;
  const styleNote = requestedStyle === "minimal" || requestedStyle === "editorial";
  const activeLength = customLength === "" ? length : Number(customLength);
  const lengthValid = isVideoLength(activeLength);
  const createPath = videoMode ? `/create/${videoMode.id}` : "/create";
  const needsUpload = videoMode ? modeNeedsUpload(videoMode) : false;
  const uploadKind = videoMode && videoMode.upload !== "none" ? videoMode.upload : null;
  const showInputTabs = !videoMode || videoMode.id === "prompt";
  const promptReady = Boolean(videoMode?.promptOptional) || prompt.trim().length >= 3;
  const acceptsReferences = !videoMode || modeAcceptsReferenceImages(videoMode);
  const hasReferences = acceptsReferences && referenceKeys.length > 0;
  const canHideText = videoMode?.id !== "lyrics" && videoMode?.id !== "captions";
  const resolvedTier = videoMode ? resolveModeTier(videoMode.id, tier) : null;
  const filmingModel = resolvedTier?.model ?? generationModelById(model);
  const clipSplit = useMemo(() => {
    if (!lengthValid || !isStitchedMode(videoMode?.id) || !filmingModel) return "";
    return formatClipSplit(planSegments(activeLength, filmingModel.durations));
  }, [lengthValid, videoMode?.id, filmingModel, activeLength]);
  const songFirst = videoMode?.id === "lyrics";
  const songRequest = useMemo<SongTakeBody | null>(
    () =>
      songFirst && lengthValid && prompt.trim().length >= 3
        ? { prompt: prompt.trim(), length: activeLength, tier, characterId, hasSinger: hasReferences }
        : null,
    [songFirst, lengthValid, prompt, activeLength, tier, characterId, hasReferences],
  );
  const songRequestKey = songRequest ? JSON.stringify(songRequest) : "";
  const [songTake, setSongTake] = useState<{ key: string; take: SongTake } | null>(null);
  const approvedTake = songTake && songTake.key === songRequestKey ? songTake.take : null;
  const estimatedCredits = useMemo(
    () =>
      videoJobCredits({
        demo,
        mode: videoMode?.id,
        tier,
        modelId: filmingModel?.id ?? model,
        resolution: resolvedTier?.resolution,
        length: lengthValid ? activeLength : MIN_VIDEO_LENGTH,
        referenceCount: referenceKeys.length,
        songReady: Boolean(approvedTake),
      }),
    [
      demo,
      videoMode?.id,
      tier,
      filmingModel?.id,
      model,
      resolvedTier?.resolution,
      lengthValid,
      activeLength,
      referenceKeys.length,
      approvedTake,
    ],
  );
  const needsUpgrade = creditBalance !== null && estimatedCredits > creditBalance && !demo;

  const generate = async (text = prompt) => {
    const value = text.trim();
    if (busy || !lengthValid || !promptReady) return;
    if (!videoMode?.promptOptional && !value) return;
    if (needsUpload && !mediaKey) return;
    if (songFirst && !approvedTake) return;

    try {
      await createVideo(
        videoMode
          ? {
              prompt: value,
              format,
              length: activeLength,
              mode: videoMode.id,
              tier,
              ...(needsUpload && mediaKey ? { mediaKey, imageKey: mediaKey } : {}),
              ...(hasReferences ? { referenceKeys } : {}),
              showText,
              presetId,
              visualDirection,
              ...(canNarrate ? { characterId } : {}),
              ...(approvedTake ? { songId: approvedTake.id } : {}),
            }
          : {
              prompt: value,
              format,
              length: activeLength,
              model,
              ...(hasReferences ? { referenceKeys } : {}),
              showText,
              presetId,
              visualDirection,
              characterId,
            },
      ).unwrap();
      clearCreateDraft(videoMode?.id);
      router.push("/videos");
    } catch (error) {
      if (apiErrorStatus(error) === 401) {
        router.push(loginPath(createPath));
        return;
      }
      const shortfall = insufficientCredits(error);
      if (shortfall) {
        setUpgrade(shortfall);
        return;
      }
      setStatus({ state: "failed", error: apiErrorMessage(error, "Couldn't queue the video."), videoId: null });
    }
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate create draft from localStorage after SSR */
    const draft = readCreateDraft(videoMode?.id);
    if (draft) {
      if (!initialPrompt) setPrompt(draft.prompt);
      if (!isInput(inputParam)) setInputMode(draft.inputMode);
      if (!isFormat(formatParam)) setFormat(draft.format);
      if (!lengthFromUrl) {
        setLength(draft.length);
        setCustomLength(draft.customLength);
      }
      if (!modelFromUrl && models.includes(draft.model)) setModel(draft.model);
      if (!(tierParam && isVideoTier(tierParam))) setTier(draft.tier);
      if (draft.mediaKey) setMediaKey(draft.mediaKey);
      if (draft.referenceKeys.length > 0) setReferenceKeys(draft.referenceKeys);
      setShowText(draft.showText);
      if (draft.presetId) setPresetId(draft.presetId);
      if (draft.visualDirection) setVisualDirection(draft.visualDirection);
      if (draft.characterId) setCharacterId(draft.characterId);
    }
    setDraftReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // Restore once from localStorage. URL query params already won on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draftReady || submitting) return;
    writeCreateDraft(
      {
        prompt,
        inputMode,
        format,
        length,
        customLength,
        model,
        tier,
        mediaKey,
        referenceKeys,
        showText,
        presetId,
        visualDirection,
        characterId,
      },
      videoMode?.id,
    );
  }, [
    draftReady,
    submitting,
    prompt,
    inputMode,
    format,
    length,
    customLength,
    model,
    tier,
    mediaKey,
    referenceKeys,
    showText,
    presetId,
    visualDirection,
    characterId,
    videoMode?.id,
  ]);

  const handleImprove = async () => {
    const description = prompt.trim();
    if (description.length < 3 || busy) return;
    setImproveError(null);
    try {
      setPrompt(await improvePrompt(description).unwrap());
    } catch (error) {
      if (apiErrorStatus(error) === 401) {
        router.push(loginPath(createPath));
        return;
      }
      setImproveError(apiErrorMessage(error, "Couldn't improve that."));
    }
  };

  useEffect(() => {
    if (autoStarted.current || searchParams.get("start") !== "1" || !prompt.trim()) return;
    autoStarted.current = true;
    void generate();
    // Runs once for a prompt handed over from the dashboard or landing page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
        className="flex flex-col gap-4"
      >
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {videoMode?.title ?? "Let's configure your video"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {videoMode?.description ?? "Ready in minutes. Preview everything before you post."}
          </p>
        </div>

        {demo && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
            Demo mode: no API key is set, so every video uses fictional sample data.
          </div>
        )}
        {styleNote && (
          <p className="rounded-xl border border-border bg-white px-3 py-2 text-xs text-muted-foreground">
            {requestedStyle === "minimal" ? "Minimal" : "Editorial"} is next. This video will use Bold.
          </p>
        )}

        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">1 · Your input</h2>
            {showInputTabs && (
            <div className="flex rounded-xl bg-muted p-1" role="group" aria-label="Input type">
              {INPUTS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={inputMode === id}
                  disabled={busy}
                  onClick={() => setInputMode(id)}
                  className={cn(
                    "cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    inputMode === id ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
              <span className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground/70">
                Script
                <span className="text-[10px] font-semibold tracking-wide">SOON</span>
              </span>
            </div>
            )}
          </div>
          {uploadKind && (
            <div className="mt-3">
              <MediaUpload kind={uploadKind} mediaKey={mediaKey} onChange={setMediaKey} disabled={busy} />
            </div>
          )}
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void generate();
              }
            }}
            rows={4}
            maxLength={MAX_PROMPT_LENGTH}
            disabled={busy}
            placeholder={videoMode?.placeholder ?? PLACEHOLDERS[inputMode]}
            aria-label="Your video prompt"
            className="mt-3 min-h-28 resize-none rounded-xl bg-background text-base md:text-sm"
          />
          {acceptsReferences && (
            <div className="mt-3">
              <MediaUpload
                kind="image"
                multiple
                mediaKeys={referenceKeys}
                onChangeKeys={setReferenceKeys}
                disabled={busy}
                label={videoMode?.id === "lyrics" ? "Singer or look" : "Reference pictures"}
                hint={
                  videoMode?.id === "lyrics"
                    ? "Optional. A photo of the singer, or a look to match."
                    : "Optional. JPEG, PNG, or WebP · under 4 MB each"
                }
              />
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={demo || busy || prompt.trim().length < 3}
              onClick={() => {
                void handleImprove();
              }}
            >
              {improving ? (
                <>
                  <LoaderCircle className="animate-spin" data-icon="inline-start" />
                  Improving…
                </>
              ) : (
                "Improve with AI"
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Natural language works. Mention the audience, the angle, and anything you want on screen.
            </p>
          </div>
          {improveError && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {improveError}
            </p>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">2 · Visual style</h2>
          <div className="mt-3">
            <PresetPicker
              engine={presetEngine}
              value={presetId}
              onChange={setPresetId}
              customPresets={customPresets}
              disabled={busy}
            />
          </div>
          {canHideText && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                aria-pressed={!showText}
                disabled={busy}
                onClick={() => setShowText((current) => !current)}
                className={cn(
                  "flex w-24 shrink-0 cursor-pointer flex-col gap-1 rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <StylePoster
                  style="bold"
                  size="picker"
                  className={cn("aspect-[3/4] w-full", !showText && "ring-2 ring-primary ring-offset-2")}
                />
                <span className="text-xs font-medium">No text</span>
              </button>
              <p className="text-xs text-muted-foreground">Turn off titles and on-screen letters. Captions still appear after you add them.</p>
            </div>
          )}
          <VisualDirectionField value={visualDirection} onChange={setVisualDirection} disabled={busy} />
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">3 · Format and length</h2>
          <fieldset className="mt-3" disabled={busy}>
            <legend className="sr-only">Format</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {FORMATS.map(({ value, label, hint, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={format === value}
                  onClick={() => setFormat(value)}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition",
                    format === value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span>
                    <span className="block font-medium text-foreground">{label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {value} · {hint}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-muted-foreground">Length</span>
            {LENGTH_CHOICES.map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                aria-pressed={customLength === "" && length === value}
                onClick={() => {
                  setCustomLength("");
                  setLength(value);
                }}
                className={cn(
                  "h-9 cursor-pointer rounded-xl px-3 text-sm font-medium transition disabled:opacity-50",
                  customLength === "" && length === value
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                {value}s
              </button>
            ))}
            <label
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium transition",
                customLength !== "" ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
            >
              <span>Custom</span>
              <input
                type="text"
                inputMode="numeric"
                aria-label="Custom length in seconds"
                disabled={busy}
                value={customLength}
                placeholder="8"
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
                  setCustomLength(digits);
                  if (digits === "") {
                    setLength((current) => ((LENGTH_CHOICES as readonly number[]).includes(current) ? current : 60));
                    return;
                  }
                  const parsed = Number(digits);
                  if (isVideoLength(parsed)) setLength(parsed);
                }}
                className="w-8 bg-transparent text-center text-inherit tabular-nums outline-none placeholder:text-current/40 disabled:opacity-50"
              />
              <span className="text-xs">s</span>
            </label>
            <span className="text-xs text-muted-foreground">
              {customLength !== "" && !isVideoLength(Number(customLength))
                ? `Use a whole number from ${MIN_VIDEO_LENGTH} to ${MAX_VIDEO_LENGTH}.`
                : clipSplit
                  ? `${MIN_VIDEO_LENGTH}–${MAX_VIDEO_LENGTH} seconds.`
                  : `${MIN_VIDEO_LENGTH}–${MAX_VIDEO_LENGTH} seconds. A model shortens anything longer than it can film.`}
            </span>
          </div>
          {clipSplit ? (
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {clipSplit}
            </p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold">4 · Character, media and extras</h2>
          <div className="mt-4">
            {videoMode ? (
              <TierPicker mode={videoMode} value={tier} onChange={setTier} disabled={busy} />
            ) : (
              <ModelPicker value={model} onChange={setModel} models={models} disabled={busy} />
            )}
          </div>
          <div className="mt-4">
            {canNarrate ? (
              <CharacterPicker
                value={characterId}
                onChange={setCharacterId}
                disabled={busy}
                usesImage={acceptsReferences && Boolean(filmingModel?.referenceImages)}
                detail={
                  videoMode?.id === "lyrics"
                    ? characterId === OFF_VOICE_ID
                      ? "No added voice keeps the sung track."
                      : "This character performs the lyrics."
                    : undefined
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">This video keeps its own audio.</p>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Media">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              Motion graphics
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
              Stock images and video
              <span className="text-[10px] font-semibold tracking-wide">SOON</span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground">
              Your uploads
              <span className="text-[10px] font-semibold tracking-wide">LATER</span>
            </span>
          </div>
          <ul className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <li className="rounded-xl bg-muted/60 px-3 py-2">
              <span className="block font-medium text-foreground">Captions</span>
              Word by word, on the preview
            </li>
            <li className="rounded-xl bg-muted/60 px-3 py-2">
              <span className="block font-medium text-foreground">Background music</span>
              Coming next
            </li>
            <li className="rounded-xl bg-muted/60 px-3 py-2">
              <span className="block font-medium text-foreground">Sources card</span>
              Closing scene, when facts are used
            </li>
          </ul>
        </section>

        {songFirst ? (
          <SongTakeStep
            request={songRequest}
            take={approvedTake}
            onTake={(take) => setSongTake({ key: songRequestKey, take })}
            onShortfall={setUpgrade}
            returnPath={createPath}
            disabled={busy}
            demo={demo}
          />
        ) : null}

        {needsUpgrade && (
          <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-primary" role="status">
            This video needs {estimatedCredits.toLocaleString()} credits. You have {creditBalance?.toLocaleString()} left.{" "}
            <Link href="/billing" className="font-medium underline underline-offset-4">
              Get more credits
            </Link>
          </p>
        )}
        {status.state === "failed" && (
          <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-red-50 p-3 text-sm" role="alert">
            <span className="flex items-center gap-2 font-medium text-destructive">
              <TriangleAlert className="size-4" aria-hidden />
              Couldn&apos;t make this video
            </span>
            <span className="text-muted-foreground">{status.error}</span>
            {status.videoId && (
              <Link href={`/videos/${status.videoId}`} className="w-fit text-primary underline-offset-4 hover:underline">
                See what was found
              </Link>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {demo ? "Demo mode is free · " : estimatedCredits > 0 ? `Uses ${estimatedCredits.toLocaleString()} credits · ` : ""}
            {needsUpgrade ? "You need more credits. " : ""}
            {songFirst && !approvedTake
              ? "Make the song and listen to it first. Filming uses that exact song."
              : "You'll go to My videos while it generates. Come back here to start another."}
          </p>
          <Button
            type="submit"
            size="lg"
            disabled={
              !promptReady ||
              busy ||
              !lengthValid ||
              (needsUpload && !mediaKey) ||
              needsUpgrade ||
              (songFirst && !approvedTake)
            }
            className="h-11 rounded-xl px-5"
          >
            {submitting ? (
              <>
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
                {songFirst ? "Starting…" : "Generating…"}
              </>
            ) : (
              <>
                {songFirst ? "Film the video" : "Generate video"}
                <ArrowRight data-icon="inline-end" />
              </>
            )}
          </Button>
        </div>
      </form>

      <aside className="hidden flex-col gap-4 lg:sticky lg:top-6 lg:flex">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Preview</span>
          <span className="text-muted-foreground">Bold · {format} · {lengthValid ? `${activeLength}s` : "custom"}</span>
        </div>
        <PreviewSample />
        <dl className="grid grid-cols-2 gap-y-2 rounded-2xl border border-border bg-white p-4 text-xs shadow-sm">
          <dt className="text-muted-foreground">Picture</dt>
          <dd className="text-right font-medium">Filmed by the model</dd>
          <dt className="text-muted-foreground">Length</dt>
          <dd className="text-right font-medium">Snaps to the model max</dd>
          <dt className="text-muted-foreground">Sound</dt>
          <dd className="text-right font-medium">When the model has it</dd>
          <dt className="text-muted-foreground">Export</dt>
          <dd className="text-right font-medium">MP4 download</dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          The frame above is a style sample. Generate films the prompt with the model you picked.
        </p>
      </aside>
      <UpgradeDialog
        open={upgrade !== null}
        required={upgrade?.required ?? 0}
        balance={upgrade?.balance ?? 0}
        onClose={() => setUpgrade(null)}
      />
    </div>
  );
}
