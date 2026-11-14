"use client";

import { useGetCharactersQuery } from "@/lib/store/endpoints/characters";

/** Look and clip choices for the picked character. Renders nothing when the character has neither. */
export function CharacterLookOptions({
  characterId,
  lookId,
  onLookId,
  useClip,
  onUseClip,
  modelTakesVideo,
  disabled = false,
}: {
  characterId: string;
  lookId: string;
  onLookId: (lookId: string) => void;
  useClip: boolean;
  onUseClip: (value: boolean) => void;
  modelTakesVideo: boolean;
  disabled?: boolean;
}) {
  const { data: characters } = useGetCharactersQuery();
  const character = characters?.find((item) => item.id === characterId);
  if (!character) return null;
  const hasClip = character.media.some((item) => item.kind === "video");
  if (character.looks.length === 0 && !(hasClip && modelTakesVideo)) return null;
  return (
    <div className="mt-3 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:gap-4">
      {character.looks.length > 0 ? (
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Look</span>
          <select
            value={character.looks.some((look) => look.id === lookId) ? lookId : ""}
            disabled={disabled}
            onChange={(event) => onLookId(event.target.value)}
            className="h-9 rounded-lg border border-input bg-background px-2.5 text-sm"
          >
            <option value="">Default pictures</option>
            {character.looks.map((look) => (
              <option key={look.id} value={look.id}>
                {look.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {hasClip && modelTakesVideo ? (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={useClip}
            disabled={disabled}
            onChange={(event) => onUseClip(event.target.checked)}
            className="size-4 accent-primary"
          />
          <span>Also send a clip of {character.name} to the model</span>
        </label>
      ) : null}
    </div>
  );
}
