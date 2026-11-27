"use client";

import {
  ArrowRight,
  Link2,
  LoaderCircle,
  RectangleHorizontal,
  RectangleVertical,
  Scissors,
  Square,
  TriangleAlert,
  X,
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
import { CharacterSlashTextarea } from "@/components/characters/character-slash-textarea";
import { smoothTransitionsApply, usesSmoothTransitions } from "@/lib/video/transitions";
import { useVideoDuration } from "@/components/use-video-duration";
import { BackgroundPicker } from "@/components/create/background-picker";
import { ShotPlanCard } from "@/components/create/shot-plan-card";
import { SkitPlanCard } from "@/components/create/skit-plan-card";
import { saveCoachHandoff, skitPlanForChat } from "@/lib/coach/handoff";
import { LENGTH_CHOICES, useCreateForm } from "@/components/create/use-create-form";
import { SongTakeStep } from "@/components/song-take-step";
import { LyricsBriefCard } from "@/components/lyrics-brief-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { videoJobCredits } from "@/lib/billing/estimate";
import { filmSecondsFor, lyricsCreditBreakdown, MAX_CUT_CAMERA } from "@/lib/music/song-plan";
import { filmedSecondsForCuts, promptPlanKey } from "@/lib/video/shot-plan";
import { mergeSongTakes } from "@/lib/music/song-take";
import { apiErrorMessage, apiErrorStatus, insufficientCredits, loginPath } from "@/lib/store/api-errors";
import { useGetCreditsQuery } from "@/lib/store/endpoints/billing";
import { useGetPresetsQuery } from "@/lib/store/endpoints/presets";
import {
  useCreateVideoMutation,
  useImprovePromptMutation,
  usePlanVideoShotsMutation,
  usePlanSkitMutation,
  useReadLinkMutation,
  type ShotPlan,
  type SkitPlan,
  type SongTake,
  type SongTakeBody,
} from "@/lib/store/endpoints/videos";
import { cn } from "@/lib/utils";
import { buildCreateBody } from "@/lib/video/create-body";
import { CharacterLookOptions } from "@/components/characters/character-look-options";
import { EDIT_CHOICES, EDIT_OPS } from "@/lib/video/edit-ops";
import { formSpecFor } from "@/lib/video/form-spec";
import { scriptSize, stillPictureCount } from "@/lib/video/script-markup";
import {
  countWords,
  maxLengthForMedia,
  secondsForWords,
  stillsUseDraft,
  type VisualMedia,
} from "@/lib/video/stills";
import { toolBySlug } from "@/lib/video/tool-catalog";
import { clipDuration, generationModelById, isTalkingHeadMode, modelFitsMode, type GenerationModelId } from "@/lib/video/models";
import {
  isDirectMode,
  modeAcceptsReferenceImages,
  resolveModeTier,
  videoModeById,
  type VideoModeId,
} from "@/lib/video/modes";
import { formatClipSplit, isStitchedMode, planSegments } from "@/lib/video/segments";
import { lyricsClipDurations } from "@/lib/video/singer-models";
import { isVideoLength, MAX_LYRICS_NOTE, MAX_PROMPT_LENGTH, MAX_VIDEO_LENGTH, MIN_VIDEO_LENGTH, type VideoFormat } from "@/lib/video/schema";
import { LYRICS_INPUTS } from "@/lib/video/lyrics-inputs";
import { defaultVoiceForMode, isCharacterId, isPresenterCharacter, modeCanNarrate, OFF_VOICE_ID } from "@/lib/voice/constants";
import { AUTO_PRESET_ID, presetById } from "@/lib/video/presets";
import {
  DEFAULT_SWAP_METHOD,
  MAX_SWAP_CHARACTERS,
  MAX_SWAP_TOTAL_SECONDS,
  MIN_SWAP_SECONDS,
  SWAP_METHOD_LABELS,
  SWAP_METHODS,
  swapLengthProblem,
  swapSplitNote,
  type SwapMethod,
} from "@/lib/video/swap";
import { clipClock, keptSeconds } from "@/lib/video/clip-edit";
import { VideoCutter } from "@/components/create/video-cutter";
import { uploadFileUrl } from "@/lib/storage/upload-key";
import { useGetCharactersQuery } from "@/lib/store/endpoints/characters";

const FORMATS: { value: VideoFormat; label: string; hint: string; icon: typeof Square }[] = [
  { value: "9:16", label: "Vertical", hint: "Shorts, TikTok, Reels", icon: RectangleVertical },
  { value: "1:1", label: "Square", hint: "Feeds, LinkedIn", icon: Square },
  { value: "16:9", label: "Wide", hint: "YouTube, Substack", icon: RectangleHorizontal },
];

const MEDIA_CHOICES: { value: VisualMedia; label: string; hint: string }[] = [
  { value: "video", label: "Filmed clips", hint: "A video model films every scene. The most motion, and the highest cost." },
  {
    value: "stills",
    label: "Animated stills",
    hint: "A picture is drawn for each part and the camera moves over it. Costs a fraction of filming.",
  },
  {
    value: "loop",
    label: "Background loop",
    hint: "The words play over a calm moving background with large captions. The lowest cost.",
  },
];

const STILL_QUALITIES: { draft: boolean; label: string; hint: string }[] = [
  { draft: true, label: "Draft pictures", hint: "Faster and half the price. Good for trying an idea." },
  { draft: false, label: "Final pictures", hint: "Sharper detail and closer to the look you picked." },
];

const PROMPT_PLACEHOLDER =
  "Why sleep matters for memory. Three things that happen while you're out cold, for a general audience.";

/** Shows the script directions by example: lines, a picture note, and a pause. */
const MARKED_SCRIPT_PLACEHOLDER = [
  "Once upon a time, in a quiet forest.",
  "A dragon appeared. [a small golden dragon between tall pines]",
  "[pause 1s]",
  "And so the story begins.",
].join("\n");

type Status = { state: "idle" } | { state: "failed"; error: string; videoId: string | null };

/** The preview page imports the card from here. */
export { ShotPlanCard };

export function Generator({
  demo,
  defaultModel,
  models,
  mode,
  tool,
}: {
  demo: boolean;
  defaultModel: GenerationModelId;
  /** Models this server can film with. */
  models: GenerationModelId[];
  mode?: VideoModeId;
  /** Catalog slug this page was opened with. It sets the copy and the starting values. */
  tool?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStyle = searchParams.get("style");
  // Catalog entries are shared constants. Memoizing the lookups tells the compiler they are never changed here.
  const videoMode = useMemo(() => (mode ? videoModeById(mode) : null), [mode]);
  const createTool = useMemo(() => {
    const requested = toolBySlug(tool);
    return requested && requested.mode === mode ? requested : null;
  }, [tool, mode]);
  const spec = useMemo(() => formSpecFor(videoMode, createTool), [videoMode, createTool]);
  const [createVideo, { isLoading: submitting }] = useCreateVideoMutation();
  const form = useCreateForm({ mode: videoMode, tool: createTool, models, defaultModel, paused: submitting });
  const {
    prompt,
    setPrompt,
    format,
    setFormat,
    length,
    setLength,
    customLength,
    setCustomLength,
    model,
    tier,
    mediaKey,
    setMediaKey,
    mediaRanges,
    setMediaRanges,
    referenceKeys,
    setReferenceKeys,
    showText,
    setShowText,
    presetId,
    setPresetId,
    visualDirection,
    setVisualDirection,
    direction,
    setDirection,
    scene,
    setScene,
    directionKeys,
    setDirectionKeys,
    sceneKeys,
    setSceneKeys,
    characterId,
    setCharacterId,
    swapExtras,
    setSwapExtras,
    media,
    setMedia,
    verbatim,
    setVerbatim,
    backgroundId,
    setBackgroundId,
    backgroundKey,
    setBackgroundKey,
    op,
    opValue,
    setOpValue,
    pickOp,
    pickTier,
    pickModel,
  } = form;
  const presetEngine = videoMode?.engine === "motion" ? "motion" : "footage";
  const canNarrate = modeCanNarrate(videoMode?.id);
  const { data: customPresets } = useGetPresetsQuery();
  const { data: creditBalance = null } = useGetCreditsQuery();
  const [planShots, { isLoading: planning }] = usePlanVideoShotsMutation();
  // A skit is planned first: every beat's shot, length and sound, then the writer approves it.
  const skitMode = videoMode?.id === "skit";
  const [planSkitShots, { isLoading: planningSkit }] = usePlanSkitMutation();
  /** Auto: the plan picks how long the skit runs. Otherwise the length row is a target. */
  const [skitAutoLength, setSkitAutoLength] = useState(true);
  const [skitPlan, setSkitPlan] = useState<{ key: string; plan: SkitPlan } | null>(null);
  const [improvePrompt, { isLoading: improving }] = useImprovePromptMutation();
  const [readLink, { isLoading: reading }] = useReadLinkMutation();
  const [linkOpen, setLinkOpen] = useState(spec.linkFirst);
  const [linkUrl, setLinkUrl] = useState("");
  /** The page the text in the box came from. Sent with the video as a record of the source. */
  const [sourceUrl, setSourceUrl] = useState("");
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  /** A page that was read while the box already held the person's own words. */
  const [pendingPage, setPendingPage] = useState<{ url: string; text: string } | null>(null);
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [improveError, setImproveError] = useState<string | null>(null);
  const autoStarted = useRef(false);
  const linkFieldId = useId();
  const [upgrade, setUpgrade] = useState<{ required: number; balance: number } | null>(null);
  const [shotPlan, setShotPlan] = useState<{ key: string; plan: ShotPlan } | null>(null);
  const busy = improving || submitting || planning || planningSkit || reading;
  const styleNote = requestedStyle === "minimal" || requestedStyle === "editorial";
  const stills = media === "stills" && spec.sections.has("media");
  const loop = media === "loop" && spec.sections.has("media");
  // Shots joined from several clips can run on from one another. Unset follows the mode's default.
  const [smoothTransitions, setSmoothTransitions] = useState<boolean | null>(null);
  const showSmooth = smoothTransitionsApply(videoMode?.id) && !stills && !loop;
  const smoothOn = smoothTransitions ?? usesSmoothTransitions(videoMode?.id, null);
  /** Drawn or looped pictures. No footage model films these, and the voice sets their length. */
  const composed = stills || loop;
  const maxLength = maxLengthForMedia(composed ? media : "video");
  const editMode = videoMode?.id === "edit";
  /** Character swap: the uploaded video sets the moves and the length, and a saved character takes the person's place. */
  const swap = videoMode?.engine === "swap";
  const [swapMethod, setSwapMethod] = useState<SwapMethod>(DEFAULT_SWAP_METHOD);
  /** The uploaded video's own length. */
  const swapSourceSeconds = useVideoDuration(swap ? mediaKey : null);
  /** What the swap uses: the kept parts when the video was cut, else all of it. */
  const swapDuration = swapSourceSeconds === null ? null : mediaRanges && mediaRanges.length > 0 ? keptSeconds(mediaRanges) : swapSourceSeconds;
  const swapProblem = swap && swapDuration !== null ? swapLengthProblem(swapDuration) : null;
  const swapNote = swap && swapDuration !== null ? swapSplitNote(swapDuration, swapMethod) : null;
  const [cutterOpen, setCutterOpen] = useState(false);
  /** The upload the cutter opened for by itself, so closing it doesn't make it pop up again. */
  const [autoCutKey, setAutoCutKey] = useState<string | null>(null);
  const tooLongToSwap = swap && mediaKey !== null && swapSourceSeconds !== null && swapSourceSeconds > MAX_SWAP_TOTAL_SECONDS + 0.05;
  if (tooLongToSwap && !mediaRanges && autoCutKey !== mediaKey) {
    // A video too long to swap opens the cutter once, right after it's picked.
    setAutoCutKey(mediaKey);
    setCutterOpen(true);
  }
  /** Character swap: re-voice the speech in the character's own voice. Kling only changes the picture. */
  const [swapVoice, setSwapVoice] = useState(true);
  const { data: savedCharacters } = useGetCharactersQuery(undefined, { skip: !swap && !skitMode });
  const swapCharacter = swap ? savedCharacters?.find((item) => item.id === characterId) : undefined;
  /**
   * Replace in video: the characters swapped in after the first, each named in the prompt with /.
   * The first stays in characterId and lookId, so a one-character swap works as it always has.
   */
  const swapsSeveral = swap && swapMethod === "replace";
  const extraCast = swapsSeveral ? swapExtras : [];
  const severalInSwap = extraCast.length > 0 && isPresenterCharacter(characterId);
  /** The mode works on an upload as it is: nothing to write, and the file sets the length. */
  const uploadOnly = !spec.showPrompt;
  const showLook = !loop && spec.sections.has("look");
  const showOp = spec.sections.has("op");
  const showFormat = spec.sections.has("format");
  const showQuality = ["tier", "model", "character", "media"].some((section) =>
    spec.sections.has(section as "tier" | "model" | "character" | "media"),
  );
  /** Step numbers shown on the section headings. They close up when a section is hidden. */
  const lookStep = 2;
  const opStep = 1 + (showLook ? 1 : 0) + 1;
  const formatStep = opStep + (showOp ? 1 : 0);
  const qualityStep = formatStep + (showFormat ? 1 : 0);
  const readAsWritten = verbatim && spec.sections.has("verbatim");
  /** A talking avatar or UGC ad says the script word for word to one picture, so the script sets the length. */
  const talkingHead = isTalkingHeadMode(videoMode?.id);
  const ugc = videoMode?.id === "ugc";
  // Notes in brackets and pauses are directions. They are not counted as words, but a pause takes time.
  const script = useMemo(() => scriptSize(prompt), [prompt]);
  const scriptWords = script.words;
  const createPath = videoMode ? `/create/${createTool?.slug ?? videoMode.id}` : "/create";
  const uploadKind = spec.uploadKind;
  const needsUpload = uploadKind !== null;
  // An avatar can speak as a character's picture instead of an upload. A UGC product photo is optional.
  const uploadMissing =
    needsUpload &&
    !mediaKey &&
    !(spec.uploadOptional && (videoMode?.id !== "avatar" || isPresenterCharacter(characterId)));
  const promptReady = Boolean(videoMode?.promptOptional) || prompt.trim().length >= 3;
  // A swap's picture is the character's, picked with / or the picker, not an extra reference.
  const acceptsReferences = !swap && (!videoMode || modeAcceptsReferenceImages(videoMode));
  const hasReferences = acceptsReferences && referenceKeys.length > 0;
  const canHideText = spec.sections.has("showText");
  const resolvedTier = videoMode ? resolveModeTier(videoMode.id, tier) : null;
  // A swap always runs on Kling Motion Control, so there is no footage model to pick.
  const usesVideoModel = !resolvedTier?.chatModel && !composed && videoMode?.engine !== "compose" && videoMode?.engine !== "swap";
  const videoModelChoices = models.filter((id) => {
    const entry = generationModelById(id);
    if (!entry) return false;
    if (!modelFitsMode(entry, videoMode?.id)) return false;
    if (videoMode?.id === "shorts" && entry.refusesRealPeople) return false;
    return true;
  });
  const selectedModel = videoModelChoices.includes(model) ? model : (videoModelChoices[0] ?? model);
  const [lookId, setLookId] = useState("");
  const [useClip, setUseClip] = useState(false);
  const filmingModel = usesVideoModel ? (generationModelById(selectedModel) ?? resolvedTier?.model ?? null) : null;
  /** The prompt goes to the video model as typed, as one clip. */
  const direct = isDirectMode(videoMode?.id);
  const pickedLength = customLength === "" ? length : Number(customLength);
  // A script read word for word runs as long as it takes to say, so the length is not a choice.
  // A direct prompt is one clip, so it runs the nearest length the chosen model can film.
  const activeLength = readAsWritten || talkingHead
    ? Math.max(MIN_VIDEO_LENGTH, script.seconds)
    : direct && filmingModel && Number.isInteger(pickedLength)
      ? clipDuration(pickedLength, filmingModel.durations)
      : pickedLength;
  // A quick edit keeps the length of the upload, so there is no length to check.
  const lengthValid =
    uploadOnly ||
    swap ||
    (skitMode && skitAutoLength) ||
    (Number.isInteger(activeLength) && activeLength >= MIN_VIDEO_LENGTH && activeLength <= maxLength);
  const songFirst = spec.planFirst === "song";
  const planFirst = spec.planFirst !== null;
  const shorts = videoMode?.id === "shorts";
  /** The words are said to camera exactly as written, so a count helps size the script. */
  const sayToCamera = shorts || talkingHead;
  const needsPresenter = (shorts || ugc) && !isPresenterCharacter(characterId);
  const needsVoice = composed && characterId === OFF_VOICE_ID;
  const needsSwapCharacter = swap && !isPresenterCharacter(characterId);
  const clipSplit = useMemo(() => {
    if (planFirst || composed || !lengthValid || !isStitchedMode(videoMode?.id) || !filmingModel) return "";
    return formatClipSplit(planSegments(activeLength, filmingModel.durations));
  }, [planFirst, composed, lengthValid, videoMode?.id, filmingModel, activeLength]);
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
  // A skit's plan is kept while nothing it was made from changes.
  const skitPlanKey = skitMode
    ? JSON.stringify({
        prompt: prompt.trim(),
        tier,
        format,
        presetId,
        visualDirection,
        length: skitAutoLength ? "auto" : activeLength,
        model: selectedModel,
      })
    : "";
  const activeSkitPlan = skitPlan && skitPlan.key === skitPlanKey ? skitPlan.plan : null;
  // A script read word for word over drawn pictures sets how many pictures there are.
  const scriptPictures = useMemo(
    () =>
      lengthValid
        ? stillPictureCount({ prompt, verbatim: readAsWritten, media: composed ? media : "video", length: activeLength })
        : undefined,
    [lengthValid, prompt, readAsWritten, composed, media, activeLength],
  );
  const listedCredits = useMemo(
    () =>
      swap
        ? // Priced by the video's length. Nothing is shown until the browser has read it.
          swapDuration
          ? videoJobCredits({ demo, mode: "swap", length: swapDuration, resolution: resolvedTier?.resolution })
          : 0
        : videoJobCredits({
        demo,
        mode: videoMode?.id,
        media: composed ? media : undefined,
        pictures: scriptPictures,
        tier,
        modelId: filmingModel?.id ?? selectedModel,
        resolution: resolvedTier?.resolution,
        length: lengthValid ? activeLength : MIN_VIDEO_LENGTH,
        referenceCount: referenceKeys.length,
        songReady: Boolean(approvedTake),
      }),
    [
      demo,
      videoMode?.id,
      composed,
      media,
      scriptPictures,
      tier,
      filmingModel?.id,
      model,
      resolvedTier?.resolution,
      lengthValid,
      activeLength,
      referenceKeys.length,
      approvedTake,
      swap,
      swapDuration,
      swapMethod,
    ],
  );
  const estimatedCredits = activeSkitPlan?.credits ?? activePlan?.credits ?? listedCredits;
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
          modelId: filmingModel?.id ?? selectedModel,
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
    if (uploadMissing) return;
    if (needsPresenter || needsVoice || needsSwapCharacter || swapProblem) return;
    if (songFirst && !approvedTake) return;

    if (skitMode && !activeSkitPlan) {
      try {
        const plan = await planSkitShots({
          prompt: value,
          tier,
          format,
          visualDirection,
          presetId,
          ...(skitAutoLength ? {} : { length: activeLength }),
        }).unwrap();
        setSkitPlan({ key: skitPlanKey, plan });
      } catch (error) {
        if (apiErrorStatus(error) === 401) {
          router.push(loginPath(createPath));
          return;
        }
        setStatus({ state: "failed", error: apiErrorMessage(error, "Couldn't plan the skit."), videoId: null });
      }
      return;
    }

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
        buildCreateBody({
          mode,
          tool: createTool?.slug,
          values: {
            prompt: value,
            format,
            length: activeSkitPlan ? activeSkitPlan.seconds : activeLength,
            ...(activeSkitPlan ? { skitPlan: activeSkitPlan.shots } : {}),
            tier,
            model: selectedModel,
            mediaKey,
            referenceKeys,
            showText,
            presetId,
            visualDirection,
            ...(showSmooth ? { smoothTransitions: smoothOn } : {}),
            characterId,
            characterLookId: lookId || undefined,
            useCharacterClip: useClip && Boolean(filmingModel?.inputs.includes("video")),
            direction,
            scene,
            directionKeys,
            sceneKeys,
            media,
            verbatim: readAsWritten,
            sourceUrl: sourceUrl || undefined,
            backgroundId,
            backgroundKey,
            op,
            opValue,
            swapMethod: swap ? swapMethod : undefined,
            mediaRanges: swap ? mediaRanges : undefined,
            characterVoice: swap && swapCharacter?.hasVoice && !severalInSwap ? swapVoice : undefined,
            cast: severalInSwap
              ? [
                  { characterId, characterLookId: lookId || undefined },
                  ...extraCast.map((item) => ({ characterId: item.id, characterLookId: item.lookId || undefined })),
                ]
              : undefined,
          },
          usesVideoModel,
          songId: approvedTake?.id,
          plan: activePlan,
        }),
      ).unwrap();
      form.clearDraft();
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

  const fillFromPage = (page: { url: string; text: string }) => {
    setPrompt(page.text.slice(0, MAX_PROMPT_LENGTH));
    setSourceUrl(page.url);
    setPendingPage(null);
    let host = "that page";
    try {
      host = new URL(page.url).hostname.replace(/^www\./, "");
    } catch {
      // The server already checked the address. The note just reads less specifically.
    }
    setLinkNote(`Read ${countWords(page.text).toLocaleString()} words from ${host}. Edit anything before you generate.`);
  };

  const handleReadLink = async () => {
    const url = linkUrl.trim();
    if (!url || busy) return;
    setLinkError(null);
    setLinkNote(null);
    setPendingPage(null);
    try {
      const page = await readLink(url).unwrap();
      const text = page.title ? `${page.title}\n\n${page.text}` : page.text;
      const ownWords = prompt.trim().length > 0 && !sourceUrl;
      if (ownWords) setPendingPage({ url: page.url, text });
      else fillFromPage({ url: page.url, text });
    } catch (error) {
      if (apiErrorStatus(error) === 401) {
        router.push(loginPath(createPath));
        return;
      }
      setLinkError(apiErrorMessage(error, "We couldn't read that link. Paste the text instead."));
    }
  };

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
            {createTool?.title ?? videoMode?.title ?? "Let's configure your video"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {createTool?.description ?? videoMode?.description ?? "Ready in minutes. Preview everything before you post."}
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
              <MediaUpload
                kind={uploadKind}
                mediaKey={mediaKey}
                onChange={setMediaKey}
                disabled={busy}
                {...(ugc
                  ? {
                      label: "Product photo (optional)",
                      hint: "Shown with your character. Say how in the direction box. A clear photo on a plain background works best.",
                    }
                  : videoMode?.id === "avatar"
                    ? {
                        label: "Photo of the speaker",
                        hint: "Or leave it empty and pick a character below. Their picture and voice are used.",
                      }
                    : {})}
              />
              {swap && mediaKey && swapSourceSeconds !== null ? (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                  {mediaRanges && mediaRanges.length > 0 ? (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        <Scissors className="size-3.5" aria-hidden />
                        Cut · {clipClock(keptSeconds(mediaRanges))} of {clipClock(swapSourceSeconds)}
                      </span>
                      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setCutterOpen(true)}>
                        Edit cut
                      </Button>
                      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => setMediaRanges(null)}>
                        Use whole video
                      </Button>
                    </>
                  ) : (
                    <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setCutterOpen(true)}>
                      <Scissors aria-hidden data-icon="inline-start" />
                      Cut video
                    </Button>
                  )}
                </div>
              ) : null}
              {cutterOpen && swap && mediaKey && swapSourceSeconds !== null ? (
                <VideoCutter
                  src={uploadFileUrl(mediaKey)}
                  duration={swapSourceSeconds}
                  initialRanges={mediaRanges}
                  minSeconds={MIN_SWAP_SECONDS}
                  maxSeconds={MAX_SWAP_TOTAL_SECONDS}
                  onSave={setMediaRanges}
                  onClose={() => setCutterOpen(false)}
                />
              ) : null}
            </div>
          )}
          {swap ? (
            <div role="radiogroup" aria-label="How to swap" className="mt-3 grid gap-2 sm:grid-cols-2">
              {SWAP_METHODS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  role="radio"
                  aria-checked={swapMethod === choice}
                  // Copying the moves takes one picture, so it waits until only one character is left.
                  disabled={busy || (choice === "moves" && severalInSwap)}
                  onClick={() => setSwapMethod(choice)}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition disabled:opacity-50",
                    swapMethod === choice
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  <span className="text-sm font-medium">{SWAP_METHOD_LABELS[choice].title}</span>
                  <span className="text-xs text-muted-foreground">
                    {choice === "moves" && severalInSwap ? "Takes one character. Delete the other names to use it." : SWAP_METHOD_LABELS[choice].detail}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {swapProblem ? (
            <div
              role="alert"
              className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <span className="min-w-0 flex-1">{swapProblem}</span>
              {swapSourceSeconds !== null && swapSourceSeconds >= MIN_SWAP_SECONDS ? (
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setCutterOpen(true)}>
                  <Scissors aria-hidden data-icon="inline-start" />
                  Cut the video
                </Button>
              ) : null}
            </div>
          ) : swapNote ? (
            <p className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground" role="status">
              {swapNote}
            </p>
          ) : null}
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
          ) : !spec.showPrompt ? null : (
            <>
          {spec.sections.has("link") ? (
            linkOpen ? (
              <div className="mt-3 rounded-xl border border-border p-3">
                <label htmlFor={linkFieldId} className="text-sm font-medium">
                  Start from a link
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    id={linkFieldId}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    value={linkUrl}
                    disabled={busy}
                    placeholder="https://"
                    onChange={(event) => setLinkUrl(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      void handleReadLink();
                    }}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl"
                    disabled={busy || linkUrl.trim().length === 0}
                    onClick={() => {
                      void handleReadLink();
                    }}
                  >
                    {reading ? (
                      <>
                        <LoaderCircle className="animate-spin" data-icon="inline-start" />
                        Reading…
                      </>
                    ) : (
                      "Read link"
                    )}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
                  {linkNote ?? "An article, a blog post, or a product page. We put its text in the box below for you to check."}
                </p>
                {pendingPage ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" role="status">
                    <span>This replaces what you typed.</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => fillFromPage(pendingPage)}>
                      Replace my text
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setPendingPage(null)}>
                      Keep my text
                    </Button>
                  </div>
                ) : null}
                {linkError ? (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {linkError}
                  </p>
                ) : null}
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3 w-fit"
                disabled={busy}
                onClick={() => setLinkOpen(true)}
              >
                <Link2 data-icon="inline-start" />
                Start from a link
              </Button>
            )
          ) : null}
          {spec.sections.has("character") ? (
            <CharacterSlashTextarea
              value={prompt}
              onChange={setPrompt}
              characterId={characterId}
              onCharacter={(character) => {
                if (swapsSeveral && isPresenterCharacter(characterId) && character.id !== characterId) {
                  // Another character for the swap. One already in it is only named again.
                  setSwapExtras((current) =>
                    current.some((item) => item.id === character.id) ? current : [...current, { id: character.id, lookId: "" }],
                  );
                  return;
                }
                setCharacterId(character.id);
                setLookId("");
                setUseClip(false);
              }}
              onClearCharacter={() => {
                setCharacterId(defaultVoiceForMode(videoMode?.id));
                setLookId("");
                setUseClip(false);
              }}
              {...(swapsSeveral
                ? {
                    attachedIds: [...(isPresenterCharacter(characterId) ? [characterId] : []), ...swapExtras.map((item) => item.id)],
                    maxAttached: MAX_SWAP_CHARACTERS,
                    onDetach: (id: string) => {
                      if (id !== characterId) {
                        setSwapExtras((current) => current.filter((item) => item.id !== id));
                        return;
                      }
                      // The first character came off, so the next one takes their place.
                      const [next, ...rest] = swapExtras;
                      setCharacterId(next ? next.id : defaultVoiceForMode(videoMode?.id));
                      setLookId(next?.lookId ?? "");
                      setUseClip(false);
                      setSwapExtras(rest);
                    },
                  }
                : {})}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void generate();
                }
              }}
              rows={4}
              maxLength={MAX_PROMPT_LENGTH}
              disabled={busy}
              markup={readAsWritten || videoMode?.id === "skit"}
              placeholder={
                readAsWritten && stills
                  ? MARKED_SCRIPT_PLACEHOLDER
                  : (createTool?.placeholder ?? videoMode?.placeholder ?? PROMPT_PLACEHOLDER)
              }
              aria-label="Your video prompt"
              className="mt-3 min-h-28 resize-none rounded-xl bg-background text-base md:text-sm"
            />
          ) : (
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
              placeholder={
                readAsWritten && stills
                  ? MARKED_SCRIPT_PLACEHOLDER
                  : (createTool?.placeholder ?? videoMode?.placeholder ?? PROMPT_PLACEHOLDER)
              }
              aria-label="Your video prompt"
              className="mt-3 min-h-28 resize-none rounded-xl bg-background text-base md:text-sm"
            />
          )}
          {acceptsReferences && (
            <div className="mt-3">
              <MediaUpload
                kind="image"
                multiple
                max={shorts ? 1 : undefined}
                mediaKeys={referenceKeys}
                onChangeKeys={setReferenceKeys}
                disabled={busy}
                label={shorts ? "Background image" : (createTool?.referenceLabel ?? "Reference pictures")}
                hint={
                  shorts
                    ? "Optional. The place behind your character. Leave it empty to let the look decide."
                    : (createTool?.referenceHint ?? "Optional. JPEG, PNG, or WebP · under 4 MB each")
                }
              />
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            {createTool?.scaffold && prompt.trim().length === 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setPrompt(createTool.scaffold ?? "")}
              >
                Start from an outline
              </Button>
            ) : null}
            {!spec.sections.has("improve") || readAsWritten ? null : (
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
              {swap
                ? swapMethod === "replace"
                  ? `Say what to replace and type / to pick who takes its place, up to ${MAX_SWAP_CHARACTERS} characters. Everything else in your video stays.`
                  : "Type / to pick who appears. Notes are optional: wardrobe or style. The video sets the moves."
                : videoMode?.id === "prompt"
                ? "One prompt is enough. Attach pictures if you have them, then plan the shots."
                : direct
                  ? "Sent to the video model exactly as typed. No look, no extra lines, no shot plan, and no voice are added."
                  : readAsWritten
                  ? "Write it the way it should sound. About 2.5 words fit in a second, so 20 seconds is about 50 words."
                  : sayToCamera
                    ? countWords(prompt) > 0
                      ? `${countWords(prompt).toLocaleString()} words, about ${secondsForWords(countWords(prompt))} seconds to say. About 2.5 words fit in a second.`
                      : "Write it the way it should sound. About 2.5 words fit in a second, so 20 seconds is about 50 words."
                    : "Natural language works. Mention the audience, the angle, and anything you want on screen."}
            </p>
          </div>
          {improveError && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {improveError}
            </p>
          )}
          {spec.sections.has("verbatim") ? (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-3 text-sm">
              <input
                type="checkbox"
                checked={verbatim}
                disabled={busy}
                onChange={(event) => setVerbatim(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                <span className="block font-medium">Read my script word for word</span>
                <span className="block text-xs text-muted-foreground">
                  {readAsWritten
                    ? scriptWords > 0
                      ? `${scriptWords.toLocaleString()} words, about ${activeLength} seconds read aloud${
                          scriptPictures ? `, ${scriptPictures} ${scriptPictures === 1 ? "picture" : "pictures"}` : ""
                        }.`
                      : "The video runs as long as the script takes to read."
                    : "Off: we write a script from your notes to fit the length you pick."}
                </span>
                {readAsWritten ? (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {stills
                      ? "A new line starts a new picture. [A note in brackets] says what that picture shows and is not read. [pause 1s] holds a silence."
                      : loop
                        ? "[pause 1s] holds a silence. Anything else in [brackets] is not read."
                        : "Anything in [brackets] is not read."}
                  </span>
                ) : null}
              </span>
            </label>
          ) : null}
          {showSmooth ? (
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-3 text-sm">
              <input
                type="checkbox"
                checked={smoothOn}
                disabled={busy}
                onChange={(event) => setSmoothTransitions(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span>
                <span className="block font-medium">Smooth transitions</span>
                <span className="block text-xs text-muted-foreground">
                  {smoothOn
                    ? "Each shot starts on the last frame of the one before and moves on from it, so the video plays as one take."
                    : "Each shot starts fresh, with a cut between them."}
                </span>
              </span>
            </label>
          ) : null}
            </>
          )}
        </section>

        {!showLook ? null : (
        <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">{lookStep} · Visual style</h2>
          <div className="mt-3">
            <PresetPicker
              engine={presetEngine}
              value={presetId}
              onChange={setPresetId}
              customPresets={customPresets}
              only={spec.presetIds}
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
          {spec.sections.has("visualDirection") ? (
            <VisualDirectionField value={visualDirection} onChange={setVisualDirection} disabled={busy} />
          ) : null}
        </section>
        )}

        {showOp ? (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-semibold">{opStep} · What to change</h2>
            {spec.lockOp ? null : (
              <div role="radiogroup" aria-label="Edit" className="mt-3 flex flex-wrap gap-2">
                {EDIT_OPS.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    role="radio"
                    aria-checked={op === choice}
                    disabled={busy}
                    onClick={() => pickOp(choice)}
                    className={cn(
                      "h-11 cursor-pointer rounded-xl px-4 text-sm font-medium transition disabled:opacity-50",
                      op === choice ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {EDIT_CHOICES[choice].label}
                  </button>
                ))}
              </div>
            )}
            <div role="radiogroup" aria-label={EDIT_CHOICES[op].label} className="mt-3 flex flex-wrap gap-2">
              {EDIT_CHOICES[op].values.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  role="radio"
                  aria-checked={opValue === choice.value}
                  disabled={busy}
                  onClick={() => setOpValue(choice.value)}
                  className={cn(
                    "h-11 cursor-pointer rounded-xl border px-4 text-sm font-medium transition disabled:opacity-50",
                    opValue === choice.value
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{EDIT_CHOICES[op].hint}</p>
          </section>
        ) : null}

        {!showFormat ? null : (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">{formatStep} · Format and length</h2>
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
          {readAsWritten ? (
            <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
              {lengthValid
                ? `Length follows your script: about ${activeLength} seconds.`
                : `This script takes about ${activeLength} seconds to read. The limit is ${maxLength}. Shorten it, or turn off word for word.`}
            </p>
          ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm text-muted-foreground">Length</span>
            {skitMode ? (
              <button
                type="button"
                disabled={busy}
                aria-pressed={skitAutoLength}
                onClick={() => setSkitAutoLength(true)}
                className={cn(
                  "h-9 cursor-pointer rounded-xl px-3 text-sm font-medium transition disabled:opacity-50",
                  skitAutoLength ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
              >
                Auto
              </button>
            ) : null}
            {LENGTH_CHOICES.map((value) => (
              <button
                key={value}
                type="button"
                disabled={busy}
                aria-pressed={!(skitMode && skitAutoLength) && customLength === "" && length === value}
                onClick={() => {
                  setSkitAutoLength(false);
                  setCustomLength("");
                  setLength(value);
                }}
                className={cn(
                  "h-9 cursor-pointer rounded-xl px-3 text-sm font-medium transition disabled:opacity-50",
                  !(skitMode && skitAutoLength) && customLength === "" && length === value
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
                customLength !== "" && !(skitMode && skitAutoLength) ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
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
                  if (digits) setSkitAutoLength(false);
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
              {skitMode && skitAutoLength
                ? "The voice sets the length: it reads the script in one take, and each shot runs while its line is heard. Pauses in the script add time."
                : skitMode
                  ? `The voice sets the length. The plan adds pauses after lines to reach about ${activeLength} seconds.`
                : customLength !== "" && !isVideoLength(Number(customLength))
                ? `Use a whole number from ${MIN_VIDEO_LENGTH} to ${MAX_VIDEO_LENGTH}.`
                : direct && filmingModel
                  ? `${filmingModel.name} films one clip of ${Math.min(...filmingModel.durations)} to ${Math.max(...filmingModel.durations)} seconds.${
                      lengthValid && activeLength !== pickedLength ? ` Yours will run ${activeLength} seconds.` : ""
                    }`
                  : clipSplit
                    ? `${MIN_VIDEO_LENGTH}–${MAX_VIDEO_LENGTH} seconds.`
                  : composed
                    ? `${MIN_VIDEO_LENGTH}–${MAX_VIDEO_LENGTH} seconds. The finished video runs as long as the voice takes.`
                    : `${MIN_VIDEO_LENGTH}–${MAX_VIDEO_LENGTH} seconds. A model shortens anything longer than it can film.`}
            </span>
          </div>
          )}
          {clipSplit ? (
            <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">
              {clipSplit}
            </p>
          ) : null}
        </section>
        )}

        {!showQuality ? null : (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">
            {qualityStep} · {loop ? "Background and voice" : direct ? "Model" : "Quality and character"}
          </h2>
          {spec.sections.has("media") ? (
            <fieldset className="mt-3" disabled={busy}>
              <legend className="text-sm font-medium">Pictures</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {MEDIA_CHOICES.map(({ value, label, hint }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={media === value}
                    onClick={() => setMedia(value)}
                    className={cn(
                      "flex min-h-11 cursor-pointer flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition",
                      media === value
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                    )}
                  >
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground">{hint}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="mt-4">
            {videoMode && loop ? (
              <BackgroundPicker
                backgroundId={backgroundId}
                backgroundKey={backgroundKey}
                onPick={setBackgroundId}
                onUpload={setBackgroundKey}
                disabled={busy}
              />
            ) : videoMode && stills ? (
              <fieldset disabled={busy}>
                <legend className="text-sm font-medium">Picture quality</legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {STILL_QUALITIES.map(({ draft, label, hint }) => {
                    const active = stillsUseDraft(tier) === draft;
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => pickTier(draft ? "low" : "pro")}
                        className={cn(
                          "flex min-h-11 cursor-pointer flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition",
                          active
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground",
                        )}
                      >
                        <span className="text-sm font-semibold text-foreground">{label}</span>
                        <span className="text-xs text-muted-foreground">{hint}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : videoMode ? (
              <TierPicker
                mode={videoMode}
                value={tier}
                disabled={busy}
                onChange={pickTier}
              />
            ) : null}
            {usesVideoModel && (
              <div className={videoMode ? "mt-4" : undefined}>
                <ModelPicker
                  value={selectedModel}
                  models={videoModelChoices}
                  disabled={busy}
                  onChange={pickModel}
                />
              </div>
            )}
          </div>
          <div className="mt-4">
            {!spec.sections.has("character") ? (
              canNarrate ? null : <p className="text-sm text-muted-foreground">This video keeps its own audio.</p>
            ) : (
              <>
              <CharacterPicker
                value={characterId}
                onChange={(next) => {
                  setCharacterId(next);
                  setLookId("");
                  setUseClip(false);
                  setSwapExtras((current) => current.filter((item) => item.id !== next));
                }}
                disabled={busy}
                usesImage={swap || talkingHead || (acceptsReferences && Boolean(filmingModel?.referenceImages))}
                {...(swap || ugc
                  ? {
                      allowOff: false,
                      allowStudio: false,
                      offLabel: "Pick a character",
                      offDetail: ugc ? "Pick who presents the ad" : "Type / in the box above, or pick one here",
                    }
                  : {})}
                detail={
                  swap
                    ? needsSwapCharacter
                      ? "Pick who appears in your video."
                      : swapMethod === "replace"
                        ? "This character replaces what you name in your video. The rest of the video and its sound stay."
                        : "This character performs the moves from your video in a new clip, with your video's sound."
                    : ugc
                    ? needsPresenter
                      ? "Pick a saved character. They are on camera, and their voice says the script."
                      : "This character is on camera and says the script in their voice, lip-synced."
                    : videoMode?.id === "avatar"
                    ? isPresenterCharacter(characterId)
                      ? mediaKey
                        ? "Your photo speaks in this character's voice, lip-synced."
                        : "This character's picture speaks in their voice, lip-synced."
                      : "Pick a character to use their picture and voice. A photo with no character speaks in the studio voice."
                    : videoMode?.id === "lyrics"  
                    ? characterId === OFF_VOICE_ID
                      ? "No added voice keeps the sung track."
                      : "This character performs the lyrics."
                    : shorts
                      ? needsPresenter
                        ? "Pick a saved character. Their face is on camera and their voice says the script."
                        : "This character is on camera and says the script."
                      : composed
                        ? needsVoice
                          ? "Pick a voice. This video is cut to the voice, so it needs one."
                          : stills
                            ? "This voice reads the script. Each picture stays up for as long as its lines take."
                            : "This voice reads the text. The background repeats until it finishes."
                        : undefined
                }
              />
              <CharacterLookOptions
                characterId={characterId}
                lookId={lookId}
                onLookId={setLookId}
                useClip={useClip}
                onUseClip={setUseClip}
                modelTakesVideo={!swap && Boolean(filmingModel?.inputs.includes("video"))}
                disabled={busy}
              />
              {severalInSwap ? (
                <div className="mt-4">
                  <p className="text-sm font-medium">Also in this video</p>
                  <ul className="mt-2 flex flex-col gap-3">
                    {extraCast.map((item) => {
                      const extra = savedCharacters?.find((entry) => entry.id === item.id);
                      return (
                        <li key={item.id} className="rounded-xl border border-border px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {extra?.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element -- character thumbnail from the upload library
                              <img src={extra.imageUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                            ) : null}
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{extra?.name ?? "Character"}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              aria-label={`Take ${extra?.name ?? "this character"} out of the video`}
                              onClick={() => setSwapExtras((current) => current.filter((entry) => entry.id !== item.id))}
                            >
                              <X data-icon="inline-start" />
                              Remove
                            </Button>
                          </div>
                          <CharacterLookOptions
                            characterId={item.id}
                            lookId={item.lookId}
                            onLookId={(next) =>
                              setSwapExtras((current) => current.map((entry) => (entry.id === item.id ? { ...entry, lookId: next } : entry)))
                            }
                            useClip={false}
                            onUseClip={() => undefined}
                            modelTakesVideo={false}
                            disabled={busy}
                          />
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Each character replaces what you name them for in the box above. With several characters, your video keeps its own voices.
                  </p>
                </div>
              ) : swapCharacter ? (
                swapCharacter.hasVoice ? (
                  <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-3 text-sm">
                    <input
                      type="checkbox"
                      checked={swapVoice}
                      disabled={busy}
                      onChange={(event) => setSwapVoice(event.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                    />
                    <span>
                      <span className="block font-medium">Use {swapCharacter.name}&apos;s voice</span>
                      <span className="block text-xs text-muted-foreground">
                        {swapVoice
                          ? `The speech in your video is re-voiced as ${swapCharacter.name}, keeping the words and timing. The background sound stays.`
                          : "The video keeps its own voice."}
                      </span>
                    </span>
                  </label>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {swapCharacter.name} has no voice yet, so the video keeps its own.{" "}
                    <Link href={`/characters/${swapCharacter.id}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      Add a voice
                    </Link>
                  </p>
                )
              ) : null}
              </>
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
        )}

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

        {activeSkitPlan ? (
          <SkitPlanCard
            plan={activeSkitPlan}
            disabled={busy}
            onChange={(shots) => setSkitPlan({ key: skitPlanKey, plan: { ...activeSkitPlan, shots } })}
            onReplan={() => setSkitPlan(null)}
            onDiscuss={() => {
              const look = presetById(presetId);
              saveCoachHandoff({
                text: skitPlanForChat({
                  script: prompt,
                  look: !presetId || presetId === AUTO_PRESET_ID || presetId === "auto"
                    ? "Auto look (a photo is drawn as a retro cartoon)"
                    : presetId === "own"
                      ? "The character's own look"
                      : `${look?.name ?? presetId} look`,
                  quality: tier.charAt(0).toUpperCase() + tier.slice(1),
                  seconds: activeSkitPlan.seconds,
                  credits: activeSkitPlan.credits,
                  smooth: smoothOn,
                  shots: activeSkitPlan.shots,
                }),
                ...(isCharacterId(characterId) ? { characterId, characterName: savedCharacters?.find((item) => item.id === characterId)?.name ?? "" } : {}),
              });
              router.push("/coach");
            }}
          />
        ) : null}
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
              : !songFirst && (!planFirst || activePlan) && (!skitMode || activeSkitPlan) && estimatedCredits > 0
                ? `Uses ${estimatedCredits.toLocaleString()} credits · `
                : ""}
            {needsUpgrade ? "You need more credits. " : ""}
            {swapProblem
              ? swapProblem
              : needsSwapCharacter
              ? "Pick who appears: type / in the box, or use the character picker."
              : needsVoice
              ? `Pick a voice in step ${qualityStep}. It reads the script.`
              : needsPresenter
              ? `Pick a character in step ${qualityStep}. They present the video.`
              : uploadMissing && videoMode?.id === "avatar"
              ? `Upload a photo of the speaker, or pick a character in step ${qualityStep}.`
              : songFirst && !approvedTake
              ? "Make the song and listen to it first. Filming uses that exact song."
              : activeSkitPlan
                ? "Check the shots and sounds above, then press Film it. You'll go to My videos while it generates."
              : skitMode
                ? "Plan the skit first: every beat's shot, how long it runs, and its sound. Nothing is filmed until you press Film it."
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
              uploadMissing ||
              needsPresenter ||
              needsVoice ||
              needsSwapCharacter ||
              Boolean(swapProblem) ||
              needsUpgrade ||
              (songFirst && !approvedTake)
            }
            className="h-11 rounded-xl px-5"
          >
            {planning || planningSkit ? (
              <>
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
                {planningSkit ? "Planning the skit…" : "Planning shots…"}
              </>
            ) : submitting ? (
              <>
                <LoaderCircle className="animate-spin" data-icon="inline-start" />
                {songFirst ? "Starting…" : "Generating…"}
              </>
            ) : (
              <>
                {activePlan || activeSkitPlan ? "Film it" : skitMode ? "Plan the skit" : planFirst ? "Plan the shots" : editMode ? "Edit video" : uploadOnly ? "Add captions" : "Generate video"}
                <ArrowRight data-icon="inline-end" />
              </>
            )}
          </Button>
        </div>
      </form>

      <aside className="hidden flex-col gap-4 lg:sticky lg:top-24 lg:flex">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Preview</span>
          <span className="text-muted-foreground">Bold · {format} · {lengthValid ? `${activeLength}s` : "custom"}</span>
        </div>
        <PreviewSample />
        <dl className="grid grid-cols-2 gap-y-2 rounded-2xl border border-border bg-card p-4 text-xs shadow-sm">
          <dt className="text-muted-foreground">Picture</dt>
          <dd className="text-right font-medium">
            {editMode
              ? "Your video, edited"
              : swap
                ? swapMethod === "replace"
                  ? "Your video, with your character in it"
                  : "Your character, doing your video's moves"
              : uploadOnly
                ? "Your video, with captions"
              : loop
                ? "A looping background"
                : stills
                  ? "Drawn, then animated"
                  : "Filmed by the model"}
          </dd>
          <dt className="text-muted-foreground">Length</dt>
          <dd className="text-right font-medium">
            {uploadOnly || swap ? "Set by your video" : composed ? "Follows the voice" : "Snaps to the model max"}
          </dd>
          <dt className="text-muted-foreground">Sound</dt>
          <dd className="text-right font-medium">
            {editMode
              ? "Kept, unless you mute it"
              : uploadOnly || swap
                ? "Kept as it is"
                : composed
                  ? "Voice and captions"
                  : "When the model has it"}
          </dd>
          <dt className="text-muted-foreground">Export</dt>
          <dd className="text-right font-medium">MP4 download</dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          {editMode
            ? "The frame above is a sample. Your own video is changed and saved as a new one."
            : swap
            ? swapMethod === "replace"
              ? "The frame above is a sample. Your video is kept, and what you name is replaced with your character."
              : "The frame above is a sample. Your character performs every move from your video, which keeps its sound."
            : uploadOnly
            ? "The frame above is a sample. The captions follow the words in your own video."
            : loop
            ? "The frame above is a sample. Generate reads your text over the background you picked."
            : stills
              ? "The frame above is a style sample. Generate draws one picture for each part of the script."
              : "The frame above is a style sample. Generate films the prompt with the model you picked."}
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
