"use client";

import { UserRound } from "lucide-react";
import Link from "next/link";
import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Textarea } from "@/components/ui/textarea";
import { insertCharacterName, matchCharacters, mentionsName, nameRanges, slashTokenAt } from "@/lib/characters/slash";
import type { CharacterSummary } from "@/lib/characters/types";
import { useGetCharactersQuery } from "@/lib/store/endpoints/characters";
import { cn } from "@/lib/utils";

type TextareaProps = Omit<ComponentProps<"textarea">, "value" | "onChange">;

const Thumb = ({ character }: { character: CharacterSummary }) => {
  if (character.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- character thumbnail from the upload library
    return <img src={character.imageUrl} alt="" className="size-8 shrink-0 rounded-lg object-cover" />;
  }
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <UserRound className="size-3.5" aria-hidden />
    </span>
  );
};

/** Text styles the highlight layer copies, so its words sit exactly under the box's words. */
const MIRRORED = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textIndent",
  "textTransform",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "boxSizing",
  "tabSize",
] as const;

/**
 * A prompt box where typing `/` lists the person's characters. Picking one writes the
 * character's name where the `/` was and attaches that character to the video. The name
 * is highlighted wherever it appears. Deleting it from the text takes the character off.
 */
export function CharacterSlashTextarea({
  value,
  onChange,
  characterId,
  onCharacter,
  onClearCharacter,
  onKeyDown,
  disabled,
  className,
  ...props
}: TextareaProps & {
  value: string;
  onChange: (value: string) => void;
  /** The character the video uses now. Ids that are not saved characters highlight nothing. */
  characterId: string;
  onCharacter: (character: CharacterSummary) => void;
  onClearCharacter: () => void;
}) {
  const listId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const { data: loaded, isLoading } = useGetCharactersQuery();
  const characters = useMemo(() => loaded ?? [], [loaded]);
  const [token, setToken] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [layer, setLayer] = useState<CSSProperties | null>(null);
  const attached = characters.find((character) => character.id === characterId);
  const pickable = useMemo(() => characters.filter((character) => character.hasImage), [characters]);
  const matches = useMemo(() => (token ? matchCharacters(pickable, token.query).slice(0, 8) : []), [pickable, token]);
  const open = token !== null && !disabled;
  const ranges = useMemo(() => (attached ? nameRanges(value, attached.name) : []), [attached, value]);

  // Keep the highlight layer on top of the box: same place, same size, same text metrics.
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const computed = getComputedStyle(element);
      const style: Record<string, string | number> = {
        top: element.offsetTop,
        left: element.offsetLeft,
        width: element.offsetWidth,
        height: element.offsetHeight,
      };
      for (const key of MIRRORED) style[key] = computed[key];
      setLayer(style as CSSProperties);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (layerRef.current && ref.current) layerRef.current.scrollTop = ref.current.scrollTop;
  }, [value, layer]);

  const readToken = (element: HTMLTextAreaElement) => {
    const next = slashTokenAt(element.value, element.selectionStart ?? element.value.length);
    setToken(next);
    if (next?.query !== token?.query) setActive(0);
  };

  const change = (next: string) => {
    // The character lives in the text. Deleting the last copy of the name takes it off.
    if (attached && mentionsName(value, attached.name) && !mentionsName(next, attached.name)) onClearCharacter();
    onChange(next);
  };

  const pick = (character: CharacterSummary) => {
    const element = ref.current;
    if (!token || !element) return;
    const caret = element.selectionStart ?? value.length;
    const next = insertCharacterName(value, token.start, caret, character.name);
    onChange(next.text);
    onCharacter(character);
    setToken(null);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(next.caret, next.caret);
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (open) {
      if (event.key === "Escape") {
        event.preventDefault();
        setToken(null);
        return;
      }
      if (matches.length > 0 && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((current) => (current + step + matches.length) % matches.length);
        return;
      }
      if (matches.length > 0 && (event.key === "Enter" || event.key === "Tab") && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        pick(matches[Math.min(active, matches.length - 1)]);
        return;
      }
    }
    onKeyDown?.(event);
  };

  const segments = useMemo(() => {
    const parts: { text: string; name: boolean }[] = [];
    let at = 0;
    for (const range of ranges) {
      if (range.start > at) parts.push({ text: value.slice(at, range.start), name: false });
      parts.push({ text: value.slice(range.start, range.end), name: true });
      at = range.end;
    }
    parts.push({ text: value.slice(at), name: false });
    return parts;
  }, [ranges, value]);

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={ref}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          change(event.target.value);
          readToken(event.target);
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => {
          if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
            readToken(event.currentTarget);
          }
        }}
        onClick={(event) => readToken(event.currentTarget)}
        onScroll={(event) => {
          if (layerRef.current) layerRef.current.scrollTop = event.currentTarget.scrollTop;
        }}
        onBlur={() => setToken(null)}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        aria-describedby={attached && ranges.length > 0 ? `${listId}-attached` : undefined}
        className={className}
      />
      {layer && ranges.length > 0 ? (
        <div
          ref={layerRef}
          aria-hidden
          style={layer}
          className="pointer-events-none absolute overflow-hidden border-solid border-transparent break-words whitespace-pre-wrap text-transparent"
        >
          {segments.map((segment, index) =>
            segment.name ? (
              <mark key={index} className="rounded-[4px] bg-primary/30 text-transparent ring-1 ring-primary/50 box-decoration-clone">
                {segment.text}
              </mark>
            ) : (
              <Fragment key={index}>{segment.text}</Fragment>
            ),
          )}
          {"​"}
        </div>
      ) : null}
      {attached && ranges.length > 0 ? (
        <span id={`${listId}-attached`} className="sr-only">
          {attached.name} is attached to this video.
        </span>
      ) : null}
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Characters"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg"
        >
          {isLoading ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">Loading characters…</p>
          ) : matches.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">
              {pickable.length === 0 ? "No characters with a picture yet. " : "No character by that name. "}
              <Link href="/characters" className="font-medium text-foreground underline-offset-4 hover:underline">
                Manage characters
              </Link>
            </p>
          ) : (
            matches.map((character, index) => (
              <div
                key={character.id}
                id={`${listId}-${character.id}`}
                role="option"
                aria-selected={index === active}
                // Keep focus in the box, so picking does not blur it and close the menu first.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(character)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5",
                  index === active ? "bg-accent text-accent-foreground" : undefined,
                )}
              >
                <Thumb character={character} />
                <span className="min-w-0 truncate text-sm font-medium">{character.name}</span>
                {character.id === characterId ? <span className="ml-auto text-xs text-muted-foreground">Attached</span> : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
