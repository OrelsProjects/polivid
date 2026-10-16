"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { MediaUpload } from "@/components/media-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_IMAGE_PROMPT } from "@/lib/characters/constants";
import { uploadFileUrl } from "@/lib/storage/upload-key";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useGenerateCharacterImageMutation } from "@/lib/store/endpoints/characters";
import { cn } from "@/lib/utils";

type ImageTab = "upload" | "generate";

export function CharacterImageField({
  imageKey,
  imagePrompt,
  disabled = false,
  onImageKey,
  onImagePrompt,
}: {
  imageKey: string;
  imagePrompt: string;
  disabled?: boolean;
  onImageKey: (key: string) => void;
  onImagePrompt: (prompt: string) => void;
}) {
  const [tab, setTab] = useState<ImageTab>(imagePrompt && !imageKey ? "generate" : "upload");
  const [generateImage, { isLoading: busy }] = useGenerateCharacterImageMutation();
  const [error, setError] = useState<string | null>(null);
  const preview = imageKey ? uploadFileUrl(imageKey) : null;

  const handleGenerate = async () => {
    if (busy || imagePrompt.trim().length < 8) {
      setError("Describe the person in a few words.");
      return;
    }
    setError(null);
    try {
      onImageKey(await generateImage(imagePrompt).unwrap());
    } catch (cause) {
      setError(apiErrorMessage(cause, "Couldn't generate that picture."));
    }
  };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium">Picture</legend>
      <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label="Picture source">
        {(
          [
            ["upload", "Upload"],
            ["generate", "Generate"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cn(
              "flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-sm",
              tab === id ? "bg-white font-medium shadow-sm" : "text-muted-foreground",
            )}
            disabled={disabled}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "upload" ? (
        <MediaUpload
          kind="image"
          mediaKey={imageKey || null}
          onChange={(key) => onImageKey(key ?? "")}
          disabled={disabled}
          label="Character picture"
          hint="A clear photo or illustration of this person."
        />
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Describe the person</span>
            <Textarea
              value={imagePrompt}
              maxLength={MAX_IMAGE_PROMPT}
              disabled={disabled || busy}
              onChange={(event) => onImagePrompt(event.target.value)}
              placeholder="A woman in her thirties, short dark hair, warm smile, linen shirt"
              aria-label="Picture prompt"
              className="min-h-24 rounded-xl"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={disabled || busy || imagePrompt.trim().length < 8}
            onClick={() => {
              void handleGenerate();
            }}
          >
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden />
                Generating…
              </>
            ) : preview ? (
              "Regenerate"
            ) : (
              "Generate"
            )}
          </Button>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- upload preview
            <img src={preview} alt="Generated character" className="h-40 w-40 rounded-2xl object-cover" />
          ) : null}
        </div>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
