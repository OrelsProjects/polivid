"use client";

import { LoaderCircle, Pencil, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AudioPlayer } from "@/components/audio-player";
import { NEW_CHARACTER_ID } from "@/components/characters/character-detail";
import { HoverItem } from "@/components/motion/motion";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CharacterSummary } from "@/lib/characters/types";
import { apiErrorMessage } from "@/lib/store/api-errors";
import {
  useDeleteCharacterMutation,
  useGetCharactersQuery,
  usePreviewCharacterVoiceMutation,
} from "@/lib/store/endpoints/characters";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/** "5 pictures · 1 clip · 2 looks" */
const libraryLabel = (character: CharacterSummary) => {
  const pictures = character.media.filter((item) => item.kind === "image").length;
  const clips = character.media.filter((item) => item.kind === "video").length;
  return [
    plural(pictures, "picture"),
    clips ? plural(clips, "clip") : "",
    character.looks.length ? plural(character.looks.length, "look") : "",
  ]
    .filter(Boolean)
    .join(" · ");
};

const voiceLabel = (character: CharacterSummary) => {
  if (character.voiceSource === "recorded") return "Recorded voice";
  if (character.voiceSource === "designed") return "Designed voice";
  return "No voice";
};

export function CharacterLibrary() {
  const { data: characters, error: loadError } = useGetCharactersQuery();
  const [previewVoice, { isLoading: previewing, originalArgs: previewArg }] = usePreviewCharacterVoiceMutation();
  const [deleteCharacter, { isLoading: deleting, originalArgs: deleteArg }] = useDeleteCharacterMutation();
  const [actionError, setActionError] = useState<string | null>(null);
  const [sample, setSample] = useState<{ id: string; url: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const previewId = previewing ? previewArg : null;
  const deletingId = deleting ? deleteArg : null;
  const error = actionError ?? (loadError ? apiErrorMessage(loadError, "Couldn't load your characters.") : null);

  useEffect(() => {
    return () => {
      if (sample) URL.revokeObjectURL(sample.url);
    };
  }, [sample]);

  const handlePreview = async (id: string) => {
    setActionError(null);
    try {
      const url = await previewVoice(id).unwrap();
      setSample((current) => {
        if (current) URL.revokeObjectURL(current.url);
        return { id, url };
      });
    } catch (cause) {
      setActionError(apiErrorMessage(cause, "Couldn't play that voice."));
    }
  };

  const handleDelete = async (id: string) => {
    setActionError(null);
    try {
      await deleteCharacter(id).unwrap();
      setSample((current) => {
        if (current?.id !== id) return current;
        URL.revokeObjectURL(current.url);
        return null;
      });
      setPendingDelete(null);
    } catch (cause) {
      setActionError(apiErrorMessage(cause, "Couldn't delete that character."));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Your characters</h2>
        <Link href={`/characters/${NEW_CHARACTER_ID}`} className={buttonVariants()}>
          New character
        </Link>
      </div>
      {!characters && !loadError ? (
        <p className="text-sm text-muted-foreground">Loading characters…</p>
      ) : !characters?.length ? (
        <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          No characters yet. Add a name and a picture, then pick them when you make a video.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {characters.map((character) => (
            <HoverItem key={character.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <Link
                href={`/characters/${character.id}`}
                className="flex items-start gap-3 rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {character.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- character library thumbnail
                  <img src={character.imageUrl} alt="" className="size-16 rounded-xl object-cover" />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <UserRound className="size-6" aria-hidden />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium transition-colors hover:text-primary">{character.name}</p>
                  <p className="text-xs text-muted-foreground">{character.hasImage ? voiceLabel(character) : "Add a picture"}</p>
                  <p className="text-xs text-muted-foreground">{libraryLabel(character)}</p>
                </div>
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                {character.hasVoice ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={previewId === character.id}
                    onClick={() => {
                      void handlePreview(character.id);
                    }}
                    aria-label={`Play ${character.name}`}
                  >
                    {previewId === character.id ? (
                      <>
                        <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden />
                        Making sample…
                      </>
                    ) : (
                      "Play sample"
                    )}
                  </Button>
                ) : null}
                <Link
                  href={`/characters/${character.id}`}
                  className={buttonVariants({ variant: "outline" })}
                  aria-label={`Edit ${character.name}`}
                >
                  <Pencil data-icon="inline-start" aria-hidden />
                  Edit
                </Link>
                {pendingDelete === character.id ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deletingId === character.id}
                      onClick={() => {
                        void handleDelete(character.id);
                      }}
                    >
                      Delete
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setPendingDelete(null)}>
                      Keep
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => setPendingDelete(character.id)} aria-label={`Delete ${character.name}`}>
                    <Trash2 data-icon="inline-start" aria-hidden />
                    Delete
                  </Button>
                )}
              </div>
              {sample?.id === character.id ? (
                <AudioPlayer src={sample.url} title={`${character.name}'s voice`} autoPlay />
              ) : null}
            </HoverItem>
          ))}
        </ul>
      )}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
