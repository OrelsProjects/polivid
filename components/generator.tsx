"use client";

import {
  ArrowRight,
  ChevronDown,
  LoaderCircle,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { UpgradeDialog } from "@/components/billing/upgrade-dialog";
import { MediaUpload } from "@/components/media-upload";
import { ModelPicker } from "@/components/model-picker";
import { TierPicker } from "@/components/tier-picker";
import { PresetPicker } from "@/components/preset-picker";
import { PreviewSample, StylePoster } from "@/components/style-frame";
import { VisualDirectionField } from "@/components/visual-direction-field";
import { CharacterPicker } from "@/components/characters/character-picker";
import { SongTakeStep } from "@/components/song-take-step";
import { LyricsBriefCard } from "@/components/lyrics-brief-card";
import { RevealPanel } from "@/components/motion/motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { videoJobCredits } from "@/lib/billing/estimate";
import { filmSecondsFor, lyricsCreditBreakdown, MAX_CUT_CAMERA, retimeCut } from "@/lib/music/song-plan";
import { filmedSecondsForCuts, promptPlanKey } from "@/lib/video/shot-plan";
import { mergeSongTakes } from "@/lib/music/song-take";
import { apiErrorMessage, apiErrorStatus, insufficientCredits, loginPath } from "@/lib/store/api-errors";
import { useGetCreditsQuery } from "@/lib/store/endpoints/billing";
import { useGetPresetsQuery } from "@/lib/store/endpoints/presets";
import {
  useCreateVideoMutation,
  useImprovePromptMutation,
  usePlanVideoShotsMutation,
  type ShotPlan,
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
import { lyricsClipDurations } from "@/lib/video/singer-models";
import { isVideoLength, MAX_LYRICS_NOTE, MAX_PROMPT_LENGTH, MAX_VIDEO_LENGTH, MIN_VIDEO_LENGTH, type VideoFormat } from "@/lib/video/schema";
import { LYRICS_INPUTS } from "@/lib/video/lyrics-inputs";
import { AUTO_PRESET_ID, defaultPresetIdFor } from "@/lib/video/presets";
import { defaultCharacterForMode, modeCanNarrate, OFF_VOICE_ID } from "@/lib/voice/constants";

const FORMATS: { value: VideoFormat; label: string; hint: string; icon: typeof Square }[] = [
  { value: "9:16", label: "Vertical", hint: "Shorts, TikTok, Reels", icon: RectangleVertical },
  { value: "1:1", label: "Square", hint: "Feeds, LinkedIn", icon: Square },
  { value: "16:9", label: "Wide", hint: "YouTube, Substack", icon: RectangleHorizontal },
];

const PROMPT_PLACEHOLDER =
  "Why sleep matters for memory. Three things that happen while you're out cold, for a general audience.";

const LENGTH_CHOICES = [30, 60, 90] as const;
const DEFAULT_CUSTOM_LENGTH = 5;

type Status = { state: "idle" } | { state: "failed"; error: string; videoId: string | null };

const isFormat = (value: string | null): value is VideoFormat =>
  value === "9:16" || value === "1:1" || value === "16:9";

const clock = (total: number) => {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/** Plain-language summary of a lyrics shot plan, plus whether every shot is trimmed the same way. */
const describeShotPlan = (plan: ShotPlan, length: number) => {
  const count = plan.cuts.length;
  const shots = count === 1 ? "1 shot" : `${count} shots`;
  const credits = `${plan.credits.toLocaleString()} credits`;
  const show = plan.cuts[0]?.seconds;
  const film = plan.cuts[0]?.filmSec;
  const uniform =
    count > 0 && plan.cuts.every((cut) => cut.seconds === show && cut.filmSec === film);
  if (uniform && show && film && film > show) {
    const shown = show === 1 ? "1 second" : `${show} seconds`;
    const filmed = film === 1 ? "1 second" : `${film} seconds`;
    return {
      lines: [
        `${shots} in this ${length}-second video. Each shot stays on screen for ${shown}.`,
        `The model films each shot for ${filmed}, then the extra is trimmed off.`,
        `${count} × ${film} seconds is ${plan.filmedSeconds} seconds of filming. ${credits}.`,
      ],
      uniformTrim: true,
    };
  }
  if (plan.filmedSeconds > length) {
    return {
      lines: [
        `${shots} in this ${length}-second video.`,
        "Shots shorter than the model can film are generated longer and trimmed.",
        `That is ${plan.filmedSeconds} seconds of filming. ${credits}.`,
      ],
      uniformTrim: false,
    };
  }
  return {
    lines: [`${shots} in this ${length}-second video. ${credits}.`],
    uniformTrim: false,
  };
};

const fieldClass =
  "w-full rounded-lg border border-transparent bg-transparent text-sm outline-none hover:border-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/** One shot row. Framing updates as you type. Length commits when the field closes. */
const ShotRow = ({
  camera,
  seconds,
  at,
  filmNote,
  disabled,
  durationLocked,
  onCamera,
  onSeconds,
}: {
  camera: string;
  seconds: number;
  at: string;
  filmNote: string | null;
  disabled?: boolean;
  durationLocked: boolean;
  onCamera: (camera: string) => void;
  onSeconds: (seconds: number) => void;
}) => {
  const [secondsDraft, setSecondsDraft] = useState<string | null>(null);
  const secondsValue = secondsDraft ?? String(seconds);
  const commitSeconds = () => {
    const draft = secondsDraft;
    setSecondsDraft(null);
    if (draft === null || !/^\d+$/.test(draft)) return;
    const parsed = Number(draft);
    if (parsed >= 1 && parsed !== seconds) onSeconds(parsed);
  };
  return (
    <li className="grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-start gap-2">
      <span className="pt-2.5 tabular-nums text-sm text-muted-foreground">{at}</span>
      <label className="min-w-0">
        <span className="sr-only">Shot at {at}</span>
        <textarea
          value={camera}
          rows={1}
          maxLength={MAX_CUT_CAMERA}
          disabled={disabled}
          placeholder="What the camera shows"
          onChange={(event) => onCamera(event.target.value.slice(0, MAX_CUT_CAMERA))}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            event.preventDefault();
            event.currentTarget.blur();
          }}
          className={cn(fieldClass, "field-sizing-content min-h-11 resize-none px-2 py-2.5 leading-5")}
        />
      </label>
      <div className="flex flex-col items-end gap-0.5">
        <label
          className={cn(
            "flex h-11 items-center rounded-lg border border-transparent pr-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
            !durationLocked && "hover:border-border",
          )}
        >
          <span className="sr-only">Seconds on screen at {at}</span>
          <input
            value={secondsValue}
            inputMode="numeric"
            disabled={disabled}
            readOnly={durationLocked}
            size={2}
            onFocus={() => {
              if (!durationLocked) setSecondsDraft(String(seconds));
            }}
            onChange={(event) => setSecondsDraft(event.target.value.replace(/\D/g, "").slice(0, 2))}
            onBlur={commitSeconds}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              event.currentTarget.blur();
            }}
            className="w-8 bg-transparent text-right text-sm tabular-nums outline-none read-only:text-muted-foreground disabled:opacity-50"
          />
          <span className="text-sm text-muted-foreground" aria-hidden>
            s
          </span>
        </label>
        {filmNote ? <span className="pr-1.5 text-xs text-muted-foreground">{filmNote}</span> : null}
      </div>
    </li>
  );
};

export const ShotPlanCard = ({
  plan,
  length,
  maxSeconds,
  disabled,
  onChange,
}: {
  plan: ShotPlan;
  length: number;
  maxSeconds: number;
  disabled?: boolean;
  onChange: (cuts: { seconds: number; camera: string; images?: number[] }[]) => void;
}) => {
  const summary = describeShotPlan(plan, length);
  const brief = plan.brief;
  const roles = plan.attachmentRoles ?? [];
  const showRead = Boolean(
    (brief && (brief.subject || brief.setting || brief.director || brief.style || brief.mustKeep || brief.mustAvoid)) ||
      roles.length > 0,
  );
  const listId = useId();
  const [open, setOpen] = useState(true);
  const rows = plan.cuts.map((cut, index) => ({
    cut,
    index,
    at: plan.cuts.slice(0, index).reduce((sum, item) => sum + item.seconds, 0),
  }));
  const shotLabel = plan.cuts.length === 1 ? "1 shot" : `${plan.cuts.length} shots`;
  const durationLocked = (index: number) => {
    const cut = plan.cuts[index];
    if (!cut) return true;
    const others = plan.cuts.filter((_, cursor) => cursor !== index);
    const canGrow = cut.seconds < maxSeconds && others.some((other) => other.seconds > 1);
    const canShrink = cut.seconds > 1 && others.some((other) => other.seconds < maxSeconds);
    return !canGrow && !canShrink;
  };
  const lengthsLocked = rows.every(({ index }) => durationLocked(index));
  const replace = (index: number, camera: string) => {
    onChange(
      plan.cuts.map((cut, cursor) =>
        cursor === index
          ? { seconds: cut.seconds, camera, images: cut.images }
          : { seconds: cut.seconds, camera: cut.camera, images: cut.images },
      ),
    );
  };
  const retime = (index: number, seconds: number) => {
    onChange(retimeCut(plan.cuts, index, seconds, length, maxSeconds));
  };
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold">Shot plan</h2>
      <div className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
        {summary.lines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      {showRead ? (
        <div className="mt-3 rounded-xl bg-muted/60 px-3 py-3">
          <h3 className="text-sm font-medium text-foreground">How we read your prompt</h3>
          <dl className="mt-2 flex flex-col gap-1.5 text-sm">
            {brief?.subject ? (
              <div>
                <dt className="text-xs text-muted-foreground">Subject</dt>
                <dd>{brief.subject}</dd>
              </div>
            ) : null}
            {brief?.setting ? (
              <div>
                <dt className="text-xs text-muted-foreground">Place</dt>
                <dd>{brief.setting}</dd>
              </div>
            ) : null}
            {brief?.director || brief?.style ? (
              <div>
                <dt className="text-xs text-muted-foreground">Look and camera</dt>
                <dd>{[brief?.director, brief?.style].filter(Boolean).join(" ")}</dd>
              </div>
            ) : null}
            {brief?.mustKeep ? (
              <div>
                <dt className="text-xs text-muted-foreground">Must stay the same</dt>
                <dd>{brief.mustKeep}</dd>
              </div>
            ) : null}
            {brief?.mustAvoid ? (
              <div>
                <dt className="text-xs text-muted-foreground">Leave out</dt>
                <dd>{brief.mustAvoid}</dd>
              </div>
            ) : null}
          </dl>
          {roles.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {roles.map((role) => (
                <li
                  key={role.index}
                  className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                >
                  Image {role.index} · {role.role}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="mt-3 flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm font-medium"
      >
        <span>{open ? "Hide shots" : `Show ${shotLabel}`}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <RevealPanel open={open} id={listId} className="mt-2">
        <ol className="flex max-h-[32rem] flex-col gap-1 overflow-y-auto px-0.5 py-0.5">
          {rows.map(({ cut, index, at }) => (
            <ShotRow
              key={index}
              camera={cut.camera}
              seconds={cut.seconds}
              at={clock(at)}
              filmNote={cut.filmSec > cut.seconds && !summary.uniformTrim ? `filmed ${cut.filmSec}s` : null}
              disabled={disabled}
              durationLocked={durationLocked(index)}
              onCamera={(camera) => replace(index, camera)}
              onSeconds={(seconds) => retime(index, seconds)}
            />
          ))}
        </ol>
        <p className="mt-2 text-xs text-muted-foreground">
          {lengthsLocked
            ? plan.cuts.every((cut) => cut.seconds === 1)
              ? "Every second is already its own shot, so the lengths stay put. Rewrite what each shot shows."
              : "Rewrite what each shot shows. These lengths already fill the video."
            : "Rewrite a shot, or change how many seconds it stays up. A longer shot borrows time from the ones after it."}
        </p>
      </RevealPanel>
    </section>
  );
};

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
  const [direction, setDirection] = useState("");
  const [scene, setScene] = useState("");
  const [directionKeys, setDirectionKeys] = useState<string[]>([]);
  const [sceneKeys, setSceneKeys] = useState<string[]>([]);
  const canNarrate = modeCanNarrate(videoMode?.id);
  const [characterId, setCharacterId] = useState(defaultCharacterForMode(videoMode?.id));
  const { data: customPresets } = useGetPresetsQuery();
  const { data: creditBalance = null } = useGetCreditsQuery();
  const [createVideo, { isLoading: submitting }] = useCreateVideoMutation();
  const [planShots, { isLoading: planning }] = usePlanVideoShotsMutation();
  const [improvePrompt, { isLoading: improving }] = useImprovePromptMutation();
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [improveError, setImproveError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const [draftReady, setDraftReady] = useState(false);
  const [upgrade, setUpgrade] = useState<{ required: number; balance: number } | null>(null);
  const [shotPlan, setShotPlan] = useState<{ key: string; plan: ShotPlan } | null>(null);
  const busy = improving || submitting || planning;
  const styleNote = requestedStyle === "minimal" || requestedStyle === "editorial";
  const activeLength = customLength === "" ? length : Number(customLength);
  const lengthValid = isVideoLength(activeLength);
  const createPath = videoMode ? `/create/${videoMode.id}` : "/create";
  const needsUpload = videoMode ? modeNeedsUpload(videoMode) : false;
  const uploadKind = videoMode && videoMode.upload !== "none" ? videoMode.upload : null;
  const promptReady = Boolean(videoMode?.promptOptional) || prompt.trim().length >= 3;
  const acceptsReferences = !videoMode || modeAcceptsReferenceImages(videoMode);
  const hasReferences = acceptsReferences && referenceKeys.length > 0;
  const canHideText = videoMode?.id !== "lyrics" && videoMode?.id !== "captions";
  const resolvedTier = videoMode ? resolveModeTier(videoMode.id, tier) : null;
  const filmingModel = resolvedTier?.model ?? generationModelById(model);
  const songFirst = videoMode?.id === "lyrics";
  const planFirst = songFirst || videoMode?.id === "prompt";
  const clipSplit = useMemo(() => {
    if (planFirst || !lengthValid || !isStitchedMode(videoMode?.id) || !filmingModel) return "";
    return formatClipSplit(planSegments(activeLength, filmingModel.durations));
  }, [planFirst, lengthValid, videoMode?.id, filmingModel, activeLength]);
  const songRequest = useMemo<SongTakeBody | null>(
    () =>
      songFirst && lengthValid && prompt.trim().length >= 3
        ? { prompt: prompt.trim(), length: activeLength, tier, characterId, hasSinger: hasReferences }
        : null,
    [songFirst, lengthValid, prompt, activeLength, tier, characterId, hasReferences],
  );
  const songTakeKey = (body: SongTakeBody) => JSON.stringify(body);
  const songRequestKey = songRequest ? songTakeKey(songRequest) : "";
  // Every take is kept, tagged with the settings it was made for. A new take
  // joins the list instead of replacing the last one, so the user can go back.
  const [songTakes, setSongTakes] = useState<{ key: string; take: SongTake }[]>([]);
  const [songSelection, setSongSelection] = useState<{ key: string; id: string } | null>(null);
  const fittingTakes = useMemo(
    () => mergeSongTakes([], songTakes.filter((entry) => entry.key === songRequestKey).map((entry) => entry.take)),
    [songTakes, songRequestKey],
  );
  const approvedTake =
    (songSelection?.key === songRequestKey
      ? fittingTakes.find((take) => take.id === songSelection.id)
      : undefined) ??
    fittingTakes[fittingTakes.length - 1] ??
    null;
  const rememberSongTakes = (key: string, incoming: SongTake[]) => {
    if (!key || incoming.length === 0) return;
    setSongTakes((current) => {
      const kept = current.filter((entry) => !incoming.some((take) => take.id === entry.take.id));
      return [...kept, ...incoming.map((take) => ({ key, take }))];
    });
  };
  const shotPlanKey = !planFirst
    ? ""
    : songFirst
      ? JSON.stringify({
          prompt: prompt.trim(),
          direction: direction.trim(),
          scene: scene.trim(),
          length: lengthValid ? activeLength : 0,
          tier,
          references: referenceKeys.length,
          song: approvedTake?.id ?? "",
        })
      : promptPlanKey({
          prompt,
          length: lengthValid ? activeLength : 0,
          tier,
          format,
          references: referenceKeys,
          presetId,
          visualDirection,
          characterId,
        });
  const activePlan = shotPlan && shotPlan.key === shotPlanKey ? shotPlan.plan : null;
  const listedCredits = useMemo(
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
  const estimatedCredits = activePlan?.credits ?? listedCredits;
  const shotLimit = useMemo(() => {
    if (!lengthValid || !filmingModel) return MAX_VIDEO_LENGTH;
    const durations =
      videoMode?.id === "lyrics" ? lyricsClipDurations(filmingModel, referenceKeys.length > 0) : filmingModel.durations;
    const longest = durations.length > 0 ? Math.max(...durations) : activeLength;
    return Math.min(activeLength, longest);
  }, [lengthValid, filmingModel, videoMode?.id, referenceKeys.length, activeLength]);
  const reviseShots = (cuts: { seconds: number; camera: string; images?: number[] }[]) => {
    if (!activePlan || !filmingModel || !lengthValid) return;
    const secondsChanged =
      cuts.length !== activePlan.cuts.length ||
      cuts.some((cut, index) => cut.seconds !== activePlan.cuts[index]?.seconds);
    if (!secondsChanged) {
      setShotPlan({
        key: shotPlanKey,
        plan: {
          ...activePlan,
          cuts: activePlan.cuts.map((cut, index) => ({
            ...cut,
            camera: (cuts[index]?.camera ?? cut.camera).slice(0, MAX_CUT_CAMERA),
            images: cuts[index]?.images ?? cut.images,
          })),
        },
      });
      return;
    }
    const durations =
      videoMode?.id === "lyrics" ? lyricsClipDurations(filmingModel, referenceKeys.length > 0) : filmingModel.durations;
    const nextCuts = cuts.map((cut) => ({
      seconds: cut.seconds,
      camera: cut.camera.slice(0, MAX_CUT_CAMERA),
      ...(cut.images && cut.images.length > 0 ? { images: cut.images } : {}),
      filmSec: filmSecondsFor(cut.seconds, durations),
    }));
    const filmed =
      videoMode?.id === "lyrics"
        ? lyricsCreditBreakdown(activeLength, durations, referenceKeys.length > 0, nextCuts)
        : null;
    setShotPlan({
      key: shotPlanKey,
      plan: {
        ...activePlan,
        cuts: nextCuts,
        filmedSeconds: filmed ? filmed.singerSeconds + filmed.brollSeconds : filmedSecondsForCuts(activeLength, durations, nextCuts),
        credits: videoJobCredits({
          demo,
          mode: videoMode?.id,
          tier,
          modelId: filmingModel.id,
          resolution: resolvedTier?.resolution,
          length: activeLength,
          referenceCount: referenceKeys.length,
          songReady: Boolean(approvedTake),
          cuts: nextCuts,
        }),
      },
    });
  };
  const needsUpgrade = creditBalance !== null && estimatedCredits > creditBalance && !demo;

  const generate = async (text = prompt) => {
    const value = text.trim();
    if (busy || !lengthValid || !promptReady) return;
    if (!videoMode?.promptOptional && !value) return;
    if (needsUpload && !mediaKey) return;
    if (songFirst && !approvedTake) return;

    if (planFirst && !activePlan) {
      try {
        const plan = await planShots({
          mode: songFirst ? "lyrics" : "prompt",
          prompt: value,
          direction: songFirst ? direction : "",
          scene: songFirst ? scene : "",
          length: activeLength,
          tier,
          format,
          referenceCount: referenceKeys.length,
          songReady: Boolean(approvedTake),
          ...(songFirst
            ? {}
            : {
                visualDirection,
                presetId,
              }),
        }).unwrap();
        setShotPlan({ key: shotPlanKey, plan });
      } catch (error) {
        if (apiErrorStatus(error) === 401) {
          router.push(loginPath(createPath));
          return;
        }
        setStatus({ state: "failed", error: apiErrorMessage(error, "Couldn't plan the shots."), videoId: null });
      }
      return;
    }

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
              ...(songFirst
                ? {
                    direction,
                    scene,
                    ...(directionKeys.length > 0 ? { directionKeys } : {}),
                    ...(sceneKeys.length > 0 ? { sceneKeys } : {}),
                  }
                : {}),
              ...(canNarrate ? { characterId } : {}),
              ...(approvedTake ? { songId: approvedTake.id } : {}),
              ...(activePlan
                ? {
                    cuts: activePlan.cuts.map(({ seconds, camera, images }) => ({
                      seconds,
                      camera,
                      ...(images && images.length > 0 ? { images } : {}),
                    })),
                  }
                : {}),
              ...(videoMode.id === "prompt" && activePlan?.brief ? { brief: activePlan.brief } : {}),
              ...(videoMode.id === "prompt" && activePlan?.attachmentRoles
                ? { attachmentRoles: activePlan.attachmentRoles }
                : {}),
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
      if (draft.direction) setDirection(draft.direction);
      if (draft.scene) setScene(draft.scene);
      if (draft.directionKeys.length > 0) setDirectionKeys(draft.directionKeys);
      if (draft.sceneKeys.length > 0) setSceneKeys(draft.sceneKeys);
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
        direction,
        scene,
        directionKeys,
        sceneKeys,
        characterId,
      },
      videoMode?.id,
    );
  }, [
    draftReady,
    submitting,
    prompt,
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
    direction,
    scene,
    directionKeys,
    sceneKeys,
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
          <p className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
            {requestedStyle === "minimal" ? "Minimal" : "Editorial"} is next. This video will use Bold.
          </p>
        )}

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">1 · Your input</h2>
          {uploadKind && (
            <div className="mt-3">
              <MediaUpload kind={uploadKind} mediaKey={mediaKey} onChange={setMediaKey} disabled={busy} />
            </div>
          )}
          {songFirst ? (
            <div className="mt-3 flex flex-col gap-3">
              <LyricsBriefCard
                label={LYRICS_INPUTS.lyrics.label}
                placeholder={LYRICS_INPUTS.lyrics.placeholder}
                template={LYRICS_INPUTS.lyrics.template}
                value={prompt}
                onChange={setPrompt}
                maxLength={MAX_PROMPT_LENGTH}
                rows={6}
                disabled={busy}
              />
              <LyricsBriefCard
                label={LYRICS_INPUTS.director.label}
                placeholder={LYRICS_INPUTS.director.placeholder}
                template={LYRICS_INPUTS.director.template}
                value={direction}
                onChange={setDirection}
                maxLength={MAX_LYRICS_NOTE}
                rows={4}
                disabled={busy}
                images={{
                  label: "Shot references",
                  hint: "Optional. A frame you want the camera to match. Up to 3.",
                  keys: directionKeys,
                  onChange: setDirectionKeys,
                }}
              />
              <LyricsBriefCard
                label={LYRICS_INPUTS.scene.label}
                placeholder={LYRICS_INPUTS.scene.placeholder}
                template={LYRICS_INPUTS.scene.template}
                value={scene}
                onChange={setScene}
                maxLength={MAX_LYRICS_NOTE}
                rows={4}
                disabled={busy}
                images={{
                  label: "Scene references",
                  hint: "Optional. The place, set, or wardrobe to match. Up to 3.",
                  keys: sceneKeys,
                  onChange: setSceneKeys,
                }}
              />
            </div>
          ) : (
            <>
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
            placeholder={videoMode?.placeholder ?? PROMPT_PLACEHOLDER}
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
                label="Reference pictures"
                hint="Optional. JPEG, PNG, or WebP · under 4 MB each"
              />
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            {videoMode?.id === "prompt" ? null : (
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
            )}
            <p className="text-xs text-muted-foreground">
              {videoMode?.id === "prompt"
                ? "One prompt is enough. Attach pictures if you have them, then plan the shots."
                : "Natural language works. Mention the audience, the angle, and anything you want on screen."}
            </p>
          </div>
          {improveError && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {improveError}
            </p>
          )}
            </>
          )}
        </section>

        <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
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
                  className={cn("aspect-[3/4] w-full", !showText && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
                />
                <span className="text-xs font-medium">No text</span>
              </button>
              <p className="text-xs text-muted-foreground">Turn off titles and on-screen letters. Captions still appear after you add them.</p>
            </div>
          )}
          {!songFirst ? (
            <VisualDirectionField value={visualDirection} onChange={setVisualDirection} disabled={busy} />
          ) : null}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
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

        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">4 · Quality and character</h2>
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
            {songFirst && acceptsReferences ? (
              <div className="mt-4">
                <MediaUpload
                  kind="image"
                  multiple
                  mediaKeys={referenceKeys}
                  onChangeKeys={setReferenceKeys}
                  disabled={busy}
                  label="Singer photo"
                  hint="Optional. A photo of the person who sings. The first picture is the performer."
                />
              </div>
            ) : null}
          </div>
        </section>

        {songFirst ? (
          <SongTakeStep
            request={songRequest}
            takes={fittingTakes}
            take={approvedTake}
            onTake={(take, madeFor) => {
              // Tag the take with the settings it was made for. Using the
              // current key here would approve a song composed for other
              // lyrics or a different length, and filming it would be rejected.
              const key = songTakeKey(madeFor);
              rememberSongTakes(key, [take]);
              setSongSelection({ key, id: take.id });
            }}
            onSelect={(take) => setSongSelection({ key: songRequestKey, id: take.id })}
            onRestore={(takes, restoredFor) => rememberSongTakes(songTakeKey(restoredFor), takes)}
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
          <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm" role="alert">
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

        {activePlan ? (
          <ShotPlanCard
            plan={activePlan}
            length={activeLength}
            maxSeconds={shotLimit}
            disabled={busy}
            onChange={reviseShots}
          />
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {demo
              ? "Demo mode is free · "
              : !songFirst && (!planFirst || activePlan) && estimatedCredits > 0
                ? `Uses ${estimatedCredits.toLocaleString()} credits · `
                : ""}
            {needsUpgrade ? "You need more credits. " : ""}
            {songFirst && !approvedTake
              ? "Make the song and listen to it first. Filming uses that exact song."
              : activePlan
                ? "Edit the shots above, then press Film it. You'll go to My videos while it generates."
                : songFirst
                  ? "The director notes decide how many shots this video needs."
                  : planFirst
                    ? "Plan the shots first. Nothing is filmed until you press Film it."
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
            {planning ? (
              <>
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
                Planning shots…
              </>
            ) : submitting ? (
              <>
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
                {songFirst ? "Starting…" : "Generating…"}
              </>
            ) : (
              <>
                {activePlan ? "Film it" : planFirst ? "Plan the shots" : "Generate video"}
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
        <dl className="grid grid-cols-2 gap-y-2 rounded-2xl border border-border bg-card p-4 text-xs shadow-sm">
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
