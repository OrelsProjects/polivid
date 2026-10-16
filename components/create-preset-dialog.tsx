"use client";

import { LoaderCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useCreatePresetMutation, usePolishPresetMutation } from "@/lib/store/endpoints/presets";
import { MAX_PRESET_FRAGMENT, MAX_PRESET_NAME } from "@/lib/video/presets";
import type { CustomPresetTile } from "@/components/preset-picker";

export function CreatePresetDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (preset: CustomPresetTile) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [polishPreset, { isLoading: polishing }] = usePolishPresetMutation();
  const [createPreset, { isLoading: saving }] = useCreatePresetMutation();
  const busy = saving ? "save" : polishing ? "polish" : null;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (open) {
      setName("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  const handlePolish = async () => {
    if (description.trim().length < 8 || busy) return;
    setError(null);
    try {
      setDescription(await polishPreset(description).unwrap());
    } catch (caught) {
      setError(apiErrorMessage(caught, "Couldn't polish that."));
    }
  };

  const handleSave = async () => {
    if (name.trim().length < 2 || description.trim().length < 8 || busy) return;
    setError(null);
    try {
      onCreated(await createPreset({ name, promptFragment: description }).unwrap());
    } catch (caught) {
      setError(apiErrorMessage(caught, "Couldn't save that preset."));
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="create-preset-title"
      onClose={onClose}
      onClick={handleBackdropClick}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-black/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 id="create-preset-title" className="text-base font-semibold">
            Create a preset
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Describe the render, not a studio name: light, materials, camera, mood.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid size-8 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-3 px-5 py-4">
        <label className="text-sm font-medium">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value.slice(0, MAX_PRESET_NAME))}
            maxLength={MAX_PRESET_NAME}
            disabled={busy !== null}
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </label>
        <label className="text-sm font-medium">
          Style
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value.slice(0, MAX_PRESET_FRAGMENT))}
            maxLength={MAX_PRESET_FRAGMENT}
            disabled={busy !== null}
            rows={4}
            placeholder="Soft rounded 3D, warm key light, large expressive eyes, shallow depth of field."
            className="mt-1 min-h-24 resize-none rounded-xl bg-background"
          />
        </label>
        {error && (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">
        <Button type="button" variant="outline" disabled={busy !== null || description.trim().length < 8} onClick={() => void handlePolish()}>
          {busy === "polish" ? (
            <>
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
              Polishing…
            </>
          ) : (
            "Polish with AI"
          )}
        </Button>
        <Button type="button" disabled={busy !== null || name.trim().length < 2 || description.trim().length < 8} onClick={() => void handleSave()}>
          {busy === "save" ? (
            <>
              <LoaderCircle className="animate-spin" data-icon="inline-start" />
              Saving…
            </>
          ) : (
            "Save preset"
          )}
        </Button>
      </div>
    </dialog>
  );
}
