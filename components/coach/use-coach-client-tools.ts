"use client";

import { useRouter } from "next/navigation";
import type { RefObject } from "react";
import { mergeReferenceKeys } from "@/lib/coach/reference-notes";
import { writeCreateDraft } from "@/lib/video/create-draft";
import { isVideoTier, modeAcceptsReferenceImages, videoModeById } from "@/lib/video/modes";
import { isVideoLength, VIDEO_FORMATS, type VideoFormat } from "@/lib/video/schema";
import { isCharacterId, modeCanNarrate, OFF_VOICE_ID } from "@/lib/voice/constants";

const isFormat = (value: unknown): value is VideoFormat =>
  typeof value === "string" && (VIDEO_FORMATS as readonly string[]).includes(value);

const chosenCharacter = (requested: unknown, attached: string, allowsVoice: boolean) => {
  if (!allowsVoice) return "";
  if (isCharacterId(attached) && attached !== OFF_VOICE_ID) return attached;
  return isCharacterId(requested) ? requested : "";
};

export const useCoachClientTools = (referenceKeysRef: RefObject<string[]>, voiceRef: RefObject<string>) => {
  const router = useRouter();

  const run = (toolName: string, input: Record<string, unknown>) => {
    if (toolName === "app_open_create") {
      const mode = typeof input.mode === "string" ? input.mode : undefined;
      const modeDef = mode ? videoModeById(mode) : videoModeById("prompt");
      const fromTool = Array.isArray(input.referenceKeys)
        ? input.referenceKeys.filter((key): key is string => typeof key === "string")
        : [];
      const referenceKeys =
        modeDef && modeAcceptsReferenceImages(modeDef)
          ? mergeReferenceKeys(fromTool, referenceKeysRef.current)
          : [];
      const length = typeof input.length === "number" && isVideoLength(input.length) ? input.length : 30;
      writeCreateDraft(
        {
          prompt: typeof input.prompt === "string" ? input.prompt : "",
          inputMode: "topic",
          format: isFormat(input.format) ? input.format : "9:16",
          length,
          customLength: String(length),
          model: "wan",
          tier: typeof input.tier === "string" && isVideoTier(input.tier) ? input.tier : "pro",
          mediaKey: null,
          referenceKeys,
          showText: true,
          presetId: typeof input.presetId === "string" ? input.presetId : "auto",
          visualDirection: typeof input.visualDirection === "string" ? input.visualDirection : "",
          characterId: chosenCharacter(input.characterId, voiceRef.current, !mode || modeCanNarrate(mode)),
        },
        mode,
      );
      router.push(mode ? `/create/${mode}` : "/create");
      return { opened: mode ? `/create/${mode}` : "/create" };
    }
    if (toolName === "app_open_video" && typeof input.videoId === "string") {
      router.push(`/videos/${input.videoId}`);
      return { opened: `/videos/${input.videoId}` };
    }
    if (toolName === "app_open_production" && typeof input.productionId === "string") {
      router.push(`/productions/${input.productionId}`);
      return { opened: `/productions/${input.productionId}` };
    }
    return { skipped: true };
  };

  return { run };
};
