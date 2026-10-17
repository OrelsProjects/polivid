"use client";

import { ChevronDown, CircleOff, ImageIcon, Mic, MicOff, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, type ReactNode } from "react";
import { useCharacters } from "@/components/characters/use-characters";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CharacterSummary } from "@/lib/characters/types";
import { OFF_VOICE_ID, STUDIO_VOICE_ID } from "@/lib/voice/constants";
import { cn } from "@/lib/utils";

const voiceName = (character: CharacterSummary) => {
  if (!character.hasVoice) return "No voice";
  if (character.voiceSource === "designed") return "Designed voice";
  if (character.voiceSource === "recorded") return "Recorded voice";
  return "Voice";
};

const characterSummary = (character: CharacterSummary) =>
  character.hasImage ? `${voiceName(character)} · Picture` : "Needs a picture";

const Avatar = ({ character, size = "md" }: { character?: CharacterSummary; size?: "sm" | "md" }) => {
  const box = size === "sm" ? "size-9" : "size-10";
  if (character?.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- character thumbnail from the upload library
    return <img src={character.imageUrl} alt="" className={cn(box, "shrink-0 rounded-lg object-cover")} />;
  }
  return (
    <span className={cn(box, "flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground")}>
      <UserRound className="size-4" aria-hidden />
    </span>
  );
};

const IconTile = ({ children }: { children: ReactNode }) => (
  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
    {children}
  </span>
);

const OptionText = ({ title, detail }: { title: string; detail: ReactNode }) => (
  <span className="flex min-w-0 flex-col">
    <span className="truncate text-sm font-medium">{title}</span>
    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">{detail}</span>
  </span>
);

export function CharacterPicker({
  value,
  onChange,
  disabled = false,
  allowOff = true,
  offLabel = "No added voice",
  studioLabel = "Studio narrator",
  detail,
  compact = false,
  usesImage = true,
  onSelectCharacter,
  characters: charactersProp,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  allowOff?: boolean;
  offLabel?: string;
  studioLabel?: string;
  detail?: string;
  compact?: boolean;
  usesImage?: boolean;
  onSelectCharacter?: (character: CharacterSummary | null) => void;
  /** Pass a list the parent already loaded, to skip a second fetch. */
  characters?: CharacterSummary[];
}) {
  const router = useRouter();
  const labelId = useId();
  const loaded = useCharacters(!charactersProp);
  const characters = charactersProp ?? loaded;
  const planVoice = studioLabel === "Plan voice";

  const selected = characters.find((character) => character.id === value);
  const needsPicture = characters.filter((character) => !character.hasImage);
  const offDetail = "No narration or reference picture";
  const studioDetail = planVoice ? "Voices written into the plan" : "Built-in narrator reads the script";

  const handleChange = (next: string) => {
    if (next === OFF_VOICE_ID || next === STUDIO_VOICE_ID) {
      onChange(next);
      onSelectCharacter?.(null);
      return;
    }
    const character = characters.find((item) => item.id === next);
    if (!character?.hasImage) return;
    onChange(next);
    onSelectCharacter?.(character);
  };

  const current =
    value === OFF_VOICE_ID
      ? { title: offLabel, detail: offDetail, visual: <IconTile><CircleOff className="size-4" aria-hidden /></IconTile> }
      : value === STUDIO_VOICE_ID
        ? { title: studioLabel, detail: studioDetail, visual: <IconTile><Mic className="size-4" aria-hidden /></IconTile> }
        : {
            title: selected?.name ?? "Character",
            detail: selected ? characterSummary(selected) : "Loading…",
            visual: <Avatar character={selected} size="sm" />,
          };

  const fallbackDetail =
    !usesImage && selected
      ? "This mode only uses the voice."
      : allowOff && value === OFF_VOICE_ID
        ? "The picture stays as filmed."
        : value === STUDIO_VOICE_ID
          ? planVoice
            ? "The plan keeps the voice written into it."
            : "The studio narrator reads the script."
          : selected?.hasVoice
            ? "This character narrates, and their picture is a reference."
            : "This character's picture is a reference. There is no added voice.";

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        id={compact ? undefined : `${labelId}-trigger`}
        aria-label={`Character: ${current.title}`}
        className={cn(
          "flex cursor-pointer items-center text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          compact
            ? "h-10 w-auto max-w-full shrink-0 gap-2 rounded-xl border border-dashed border-border px-3 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground data-popup-open:border-primary/40"
            : "h-14 w-full gap-2.5 rounded-xl border border-input bg-background px-2 hover:bg-muted/40 data-popup-open:border-ring",
        )}
      >
        {compact ? (
          selected?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- character thumbnail from the upload library
            <img src={selected.imageUrl} alt="" className="size-5 shrink-0 rounded-md object-cover" />
          ) : value === STUDIO_VOICE_ID ? (
            <Mic className="size-4 shrink-0" aria-hidden />
          ) : value === OFF_VOICE_ID ? (
            <CircleOff className="size-4 shrink-0" aria-hidden />
          ) : (
            <UserRound className="size-4 shrink-0" aria-hidden />
          )
        ) : (
          current.visual
        )}
        <span className={cn("flex min-w-0", compact ? "max-w-36 truncate" : "flex-1 flex-col")}>
          <span className={cn("truncate", compact ? undefined : "text-sm font-medium")}>{current.title}</span>
          {compact ? null : <span className="truncate text-xs text-muted-foreground">{current.detail}</span>}
        </span>
        {compact ? null : <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-80 max-w-[calc(100vw-2rem)] p-1.5" side={compact ? "top" : "bottom"}>
        <DropdownMenuRadioGroup value={value} onValueChange={(next) => handleChange(String(next))}>
          <DropdownMenuGroup>
            {allowOff ? (
              <DropdownMenuRadioItem
                closeOnClick
                value={OFF_VOICE_ID}
                aria-label={`${offLabel}. ${offDetail}`}
                className="min-h-11 gap-2.5 py-1.5"
              >
                <IconTile>
                  <CircleOff className="size-4" aria-hidden />
                </IconTile>
                <OptionText title={offLabel} detail={offDetail} />
              </DropdownMenuRadioItem>
            ) : null}
            <DropdownMenuRadioItem
              closeOnClick
              value={STUDIO_VOICE_ID}
              aria-label={`${studioLabel}. ${studioDetail}`}
              className="min-h-11 gap-2.5 py-1.5"
            >
              <IconTile>
                <Mic className="size-4" aria-hidden />
              </IconTile>
              <OptionText title={studioLabel} detail={studioDetail} />
            </DropdownMenuRadioItem>
          </DropdownMenuGroup>
          {characters.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>Your characters</DropdownMenuLabel>
                {characters.map((character) => (
                  <DropdownMenuRadioItem
                    closeOnClick
                    key={character.id}
                    value={character.id}
                    disabled={!character.hasImage}
                    aria-label={`${character.name}. ${characterSummary(character)}`}
                    className="min-h-12 gap-2.5 py-1.5"
                  >
                    <Avatar character={character} size="sm" />
                    <OptionText
                      title={character.name}
                      detail={
                        !character.hasImage ? (
                          "Add a picture to use this character"
                        ) : (
                          <>
                            {character.hasVoice ? (
                              <Mic className="size-3 text-primary" aria-hidden />
                            ) : (
                              <MicOff className="size-3" aria-hidden />
                            )}
                            <span className="truncate">
                              {voiceName(character)}
                              {character.voiceSource === "designed" && character.voiceDescription
                                ? ` · ${character.voiceDescription}`
                                : ""}
                            </span>
                            {usesImage ? (
                              <>
                                <ImageIcon className="ml-1 size-3 shrink-0" aria-hidden />
                                <span className="shrink-0">Reference</span>
                              </>
                            ) : null}
                          </>
                        )
                      }
                    />
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 gap-2.5 py-1.5" onClick={() => router.push("/characters")}>
          <IconTile>
            <Plus className="size-4" aria-hidden />
          </IconTile>
          <span className="text-sm font-medium">New character</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (compact) return menu;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${labelId}-trigger`} className="text-sm font-medium">
        Character
      </label>
      {menu}
      {needsPicture.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {needsPicture.length === 1
            ? `${needsPicture[0].name} needs a picture before you can pick them.`
            : `${needsPicture.map((character) => character.name).join(", ")} need a picture before you can pick them.`}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        {detail ?? fallbackDetail}{" "}
        <Link href="/characters" className="font-medium text-foreground underline-offset-4 hover:underline">
          Manage characters
        </Link>
      </p>
    </div>
  );
}
