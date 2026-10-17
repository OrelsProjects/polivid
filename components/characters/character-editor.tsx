"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { CharacterImageField } from "@/components/characters/character-image-field";
import { CharacterVoiceField } from "@/components/characters/character-voice-field";
import { emptyTakes, type VoiceTake } from "@/components/voice/voice-recorder";
import { Button } from "@/components/ui/button";
import { MAX_CHARACTER_NAME, type VoiceMode } from "@/lib/characters/constants";
import type { CharacterSummary } from "@/lib/characters/types";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useSaveCharacterMutation } from "@/lib/store/endpoints/characters";
import { SAMPLE_PROMPTS } from "@/lib/voice/constants";

const FIELD_CLASS =
  "h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

const startingMode = (character?: CharacterSummary | null): VoiceMode => {
  if (character?.voiceSource === "recorded" || character?.voiceSource === "designed") return character.voiceSource;
  return "none";
};

export function CharacterEditor({
  character,
  onSaved,
  onCancel,
}: {
  character?: CharacterSummary | null;
  onSaved: (character: CharacterSummary) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(character?.name ?? "");
  const [imageKey, setImageKey] = useState(character?.imageKey ?? "");
  const [imagePrompt, setImagePrompt] = useState(character?.imagePrompt ?? "");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>(startingMode(character));
  const [voiceDescription, setVoiceDescription] = useState(character?.voiceDescription ?? "");
  const [generatedVoiceId, setGeneratedVoiceId] = useState("");
  const [takes, setTakes] = useState<(VoiceTake | null)[]>(emptyTakes);
  const [consent, setConsent] = useState(false);
  const [saveCharacter, { isLoading: saving }] = useSaveCharacterMutation();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      for (const take of takes) {
        if (take) URL.revokeObjectURL(take.url);
      }
    };
    // Revoke the takes that exist when the editor unmounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recordedReady = takes.every((take): take is VoiceTake => take !== null);
  const keepVoice = Boolean(character?.hasVoice) && voiceMode === startingMode(character) && !recordedReady && !generatedVoiceId;
  const canSave =
    name.trim().length >= 2 &&
    Boolean(imageKey) &&
    (voiceMode === "none" ||
      keepVoice ||
      (voiceMode === "recorded" && recordedReady && consent) ||
      (voiceMode === "designed" && Boolean(generatedVoiceId) && voiceDescription.trim().length >= 8));

  const handleSave = async () => {
    if (saving || !canSave) return;
    if (voiceMode === "recorded" && !keepVoice && !consent) {
      setError("Confirm this is your own voice.");
      return;
    }
    setError(null);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("imageKey", imageKey);
      form.set("imagePrompt", imagePrompt);
      form.set("voiceMode", keepVoice ? startingMode(character) : voiceMode);
      if (keepVoice) form.set("keepVoice", "yes");
      if (voiceMode === "recorded" && !keepVoice) {
        form.set("consent", "yes");
        for (const [index, take] of takes.entries()) {
          if (!take) continue;
          const type = take.blob.type || "audio/webm";
          const extension = type.includes("mp4") ? "m4a" : "webm";
          form.append("samples", new File([take.blob], `line-${index + 1}.${extension}`, { type }));
        }
      }
      if (voiceMode === "designed" && !keepVoice) {
        form.set("generatedVoiceId", generatedVoiceId);
        form.set("voiceDescription", voiceDescription);
      }
      onSaved(await saveCharacter({ id: character?.id, form }).unwrap());
    } catch (cause) {
      setError(apiErrorMessage(cause, "Couldn't save that character."));
    }
  };

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{character ? "Edit character" : "New character"}</h2>
        <p className="text-sm text-muted-foreground">A name and a picture are required. A voice is optional.</p>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Name</span>
        <input
          value={name}
          maxLength={MAX_CHARACTER_NAME}
          disabled={saving}
          onChange={(event) => setName(event.target.value)}
          placeholder="Maya"
          aria-label="Character name"
          className={FIELD_CLASS}
        />
      </label>
      <CharacterImageField
        imageKey={imageKey}
        imagePrompt={imagePrompt}
        disabled={saving}
        onImageKey={setImageKey}
        onImagePrompt={setImagePrompt}
      />
      <CharacterVoiceField
        voiceMode={voiceMode}
        voiceDescription={voiceDescription}
        generatedVoiceId={generatedVoiceId}
        takes={takes}
        hasExistingVoice={Boolean(character?.hasVoice)}
        disabled={saving}
        onVoiceMode={setVoiceMode}
        onVoiceDescription={setVoiceDescription}
        onGeneratedVoiceId={setGeneratedVoiceId}
        onTakesChange={setTakes}
      />
      {voiceMode === "recorded" && !keepVoice ? (
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            disabled={saving}
            onChange={(event) => setConsent(event.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>This is my own voice, and I can use it on videos I make here.</span>
        </label>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          className="h-11 rounded-xl"
          disabled={saving || !canSave}
          onClick={() => {
            void handleSave();
          }}
        >
          {saving ? (
            <>
              <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden />
              Saving…
            </>
          ) : (
            "Save character"
          )}
        </Button>
        <Button type="button" variant="ghost" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {voiceMode === "recorded" && !keepVoice ? (
        <p className="text-xs text-muted-foreground">
          Record all {SAMPLE_PROMPTS.length} parts before you save.
        </p>
      ) : null}
    </section>
  );
}
