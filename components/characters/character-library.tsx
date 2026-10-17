"use client";

import { LoaderCircle, Pencil, Trash2, UserRound } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AudioPlayer } from "@/components/audio-player";
import { CharacterEditor } from "@/components/characters/character-editor";
import { HoverItem, useMotionSafe } from "@/components/motion/motion";
import { Button } from "@/components/ui/button";
import type { CharacterSummary } from "@/lib/characters/types";
import { apiErrorMessage } from "@/lib/store/api-errors";
import {
  useDeleteCharacterMutation,
  useGetCharactersQuery,
  usePreviewCharacterVoiceMutation,
} from "@/lib/store/endpoints/characters";

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
  const [editor, setEditor] = useState<"new" | CharacterSummary | null>(null);
  const [sample, setSample] = useState<{ id: string; url: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const safe = useMotionSafe();
  const viewMotion = {
    initial: safe ? { opacity: 0, y: 8 } : false,
    animate: { opacity: 1, y: 0 },
    exit: safe ? { opacity: 0, transition: { duration: 0.12 } } : undefined,
    transition: safe ? { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const } : { duration: 0 },
  };
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
    <AnimatePresence mode="wait" initial={false}>
      {editor ? (
        <motion.div
          key="editor"
          {...viewMotion}
        >
          <CharacterEditor
            character={editor === "new" ? null : editor}
            onSaved={() => {
              setEditor(null);
              setActionError(null);
            }}
            onCancel={() => setEditor(null)}
          />
        </motion.div>
      ) : (
    <motion.div
      key="library"
      className="flex flex-col gap-6"
      {...viewMotion}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Your characters</h2>
        <Button type="button" onClick={() => setEditor("new")}>
          New character
        </Button>
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
              <div className="flex items-start gap-3">
                {character.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- character library thumbnail
                  <img src={character.imageUrl} alt="" className="size-16 rounded-xl object-cover" />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <UserRound className="size-6" aria-hidden />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium">{character.name}</p>
                  <p className="text-xs text-muted-foreground">{character.hasImage ? voiceLabel(character) : "Add a picture"}</p>
                </div>
              </div>
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
                <Button type="button" variant="outline" onClick={() => setEditor(character)} aria-label={`Edit ${character.name}`}>
                  <Pencil data-icon="inline-start" aria-hidden />
                  Edit
                </Button>
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
    </motion.div>
      )}
    </AnimatePresence>
  );
}
