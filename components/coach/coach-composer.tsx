import { MediaUpload } from "@/components/media-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CharacterPicker } from "@/components/characters/character-picker";
import type { CharacterSummary } from "@/lib/characters/types";

export function CoachComposer({
  value,
  onChange,
  onSend,
  disabled,
  referenceKeys,
  onReferenceKeys,
  onReferencesBusy,
  characterId,
  onCharacterId,
  onCharacterName,
  characters,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  referenceKeys: string[];
  onReferenceKeys: (keys: string[]) => void;
  onReferencesBusy: (busy: boolean) => void;
  characterId: string;
  onCharacterId: (value: string) => void;
  onCharacterName: (name: string) => void;
  characters?: CharacterSummary[];
}) {
  const canSend = value.trim().length > 0 || referenceKeys.length > 0;

  return (
    <form
      className="flex flex-col gap-2 border-t border-border bg-white p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSend();
      }}
    >
      <div className="flex items-center gap-2">
        <MediaUpload
          kind="image"
          multiple
          compact
          mediaKeys={referenceKeys}
          onChangeKeys={onReferenceKeys}
          onBusyChange={onReferencesBusy}
          disabled={disabled}
          label="Reference pictures"
          hint="Optional. A photo of the singer, or a look to match."
          librarySide="top"
        />
        <CharacterPicker
          compact
          value={characterId}
          onChange={onCharacterId}
          onSelectCharacter={(character) => onCharacterName(character?.name ?? "")}
          offLabel="No character"
          characters={characters}
          disabled={disabled}
        />
        {referenceKeys.length === 0 && (
          <p className="text-xs text-muted-foreground">Optional photo, or a character to star and narrate</p>
        )}
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              onSend();
            }
          }}
          rows={2}
          disabled={disabled}
          aria-label="Message the Coach"
          placeholder="Describe the video you want…"
          className="min-h-16 resize-none rounded-xl bg-background"
        />
        <Button type="submit" disabled={disabled || !canSend} className="h-10 rounded-xl px-4">
          Send
        </Button>
      </div>
    </form>
  );
}
