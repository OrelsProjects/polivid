"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { emptyTakes, VoiceRecorder, type VoiceTake } from "@/components/voice/voice-recorder";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_VOICE_DESCRIPTION, type VoiceMode } from "@/lib/characters/constants";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useDesignVoicesMutation, type VoicePreview } from "@/lib/store/endpoints/characters";
import { SAMPLE_PROMPTS } from "@/lib/voice/constants";
import { cn } from "@/lib/utils";

export function CharacterVoiceField({
  voiceMode,
  voiceDescription,
  generatedVoiceId,
  takes,
  hasExistingVoice,
  disabled = false,
  onVoiceMode,
  onVoiceDescription,
  onGeneratedVoiceId,
  onTakesChange,
}: {
  voiceMode: VoiceMode;
  voiceDescription: string;
  generatedVoiceId: string;
  takes: (VoiceTake | null)[];
  hasExistingVoice: boolean;
  disabled?: boolean;
  onVoiceMode: (mode: VoiceMode) => void;
  onVoiceDescription: (value: string) => void;
  onGeneratedVoiceId: (id: string) => void;
  onTakesChange: (takes: (VoiceTake | null)[]) => void;
}) {
  const [previews, setPreviews] = useState<VoicePreview[]>([]);
  const [designVoices, { isLoading: busy }] = useDesignVoicesMutation();
  const [error, setError] = useState<string | null>(null);
  const singCount = SAMPLE_PROMPTS.filter((prompt) => prompt.kind === "sing").length;
  const speakCount = SAMPLE_PROMPTS.length - singCount;

  const handleDesign = async () => {
    if (busy || voiceDescription.trim().length < 8) {
      setError("Describe the voice in a few words.");
      return;
    }
    setError(null);
    try {
      const next = await designVoices(voiceDescription).unwrap();
      if (next.length === 0) {
        setError("Couldn't design that voice.");
        return;
      }
      setPreviews(next);
      onGeneratedVoiceId("");
    } catch (cause) {
      setError(apiErrorMessage(cause, "Couldn't design that voice."));
    }
  };

  const handleTab = (mode: VoiceMode) => {
    onVoiceMode(mode);
    setError(null);
    if (mode !== "recorded") {
      for (const take of takes) {
        if (take) URL.revokeObjectURL(take.url);
      }
      onTakesChange(emptyTakes());
    }
    if (mode !== "designed") {
      setPreviews([]);
      onGeneratedVoiceId("");
    }
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Voice</legend>
      <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Voice source">
        {(
          [
            ["recorded", "Record"],
            ["designed", "Describe"],
            ["none", "None"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={voiceMode === id}
            className={cn(
              "flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-sm",
              voiceMode === id ? "bg-white font-medium shadow-sm" : "text-muted-foreground",
            )}
            disabled={disabled}
            onClick={() => handleTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {voiceMode === "recorded" ? (
        <div className="flex flex-col gap-3">
          {hasExistingVoice ? (
            <p className="text-sm text-muted-foreground">This character already has a recorded voice. Record again to replace it.</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Read {speakCount} lines and sing {singCount} short parts, about a minute and a half in total. The singing is
              what makes songs sound like you.
            </p>
          )}
          <VoiceRecorder disabled={disabled} takes={takes} onTakesChange={onTakesChange} />
        </div>
      ) : null}
      {voiceMode === "designed" ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Describe the voice</span>
            <Textarea
              value={voiceDescription}
              maxLength={MAX_VOICE_DESCRIPTION}
              disabled={disabled || busy}
              onChange={(event) => onVoiceDescription(event.target.value)}
              placeholder="A calm, low American news voice with a dry edge"
              aria-label="Voice description"
              className="min-h-24 rounded-xl"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || busy || voiceDescription.trim().length < 8}
            onClick={() => {
              void handleDesign();
            }}
          >
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden />
                Designing…
              </>
            ) : previews.length > 0 ? (
              "Hear three more"
            ) : (
              "Hear three voices"
            )}
          </Button>
          {previews.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {previews.map((preview, index) => (
                <li key={preview.generatedVoiceId} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
                  <audio
                    controls
                    className="h-8 w-full"
                    src={`data:audio/mpeg;base64,${preview.audioBase64}`}
                    aria-label={`Voice preview ${index + 1}`}
                  />
                  <Button
                    type="button"
                    variant={generatedVoiceId === preview.generatedVoiceId ? "default" : "outline"}
                    disabled={disabled}
                    onClick={() => onGeneratedVoiceId(preview.generatedVoiceId)}
                  >
                    {generatedVoiceId === preview.generatedVoiceId ? "Using this voice" : "Use this voice"}
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {voiceMode === "none" ? (
        <p className="text-sm text-muted-foreground">
          {hasExistingVoice
            ? "Saving without a voice removes the one already on this character."
            : "This character can still be used as a reference picture. Videos will keep their own audio, or the studio narrator."}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
