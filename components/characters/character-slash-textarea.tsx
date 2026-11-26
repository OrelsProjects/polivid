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

/** How wide the character menu opens next to the `/`. */
const MENU_WIDTH = 288;

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
 * With `attachedIds`, several characters can be attached at once, up to `maxAttached`.
 */
export function CharacterSlashTextarea({
  value,
  onChange,
  characterId,
  onCharacter,
  onClearCharacter,
  attachedIds,
  onDetach,
  maxAttached,
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
  /** Several characters at once: every one attached, in order. Leave out for one character. */
  attachedIds?: readonly string[];
  /** Several characters: their last mention was deleted, so they come off. */
  onDetach?: (id: string) => void;
  /** Several characters: how many may be attached. */
  maxAttached?: number;
}) {
  const listId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const { data: loaded, isLoading } = useGetCharactersQuery();
  const characters = useMemo(() => loaded ?? [], [loaded]);
  const [token, setToken] = useState<{ start: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  const [layer, setLayer] = useState<CSSProperties | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  /** Where the menu opens: just under the `/` being typed, inside the box's width. */
  const [menuAt, setMenuAt] = useState<{ top: number; left: number } | null>(null);
  const [scroll, setScroll] = useState(0);
  const multiple = attachedIds !== undefined;
  const attachedList = useMemo(
    () =>
      multiple
        ? attachedIds.map((id) => characters.find((character) => character.id === id)).filter((character): character is CharacterSummary => Boolean(character))
        : characters.filter((character) => character.id === characterId),
    [attachedIds, characterId, characters, multiple],
  );
  const isAttached = (id: string) => attachedList.some((character) => character.id === id);
  const full = multiple && maxAttached !== undefined && attachedList.length >= maxAttached;
  const pickable = useMemo(() => characters.filter((character) => character.hasImage), [characters]);
  const matches = useMemo(() => (token ? matchCharacters(pickable, token.query).slice(0, 8) : []), [pickable, token]);
  const open = token !== null && !disabled;
  const ranges = useMemo(() => {
    // Every attached name, in reading order. Where two overlap ("Ann" inside "Mary Ann"), the longer one is kept.
    const all = attachedList
      .flatMap((character) => nameRanges(value, character.name))
      .sort((a, b) => a.start - b.start || b.end - a.end);
    const kept: { start: number; end: number }[] = [];
    for (const range of all) {
      if (kept.length > 0 && range.start < kept[kept.length - 1]!.end) continue;
      kept.push(range);
    }
    return kept;
  }, [attachedList, value]);

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

  // Find the `/` on screen: a hidden copy of the text up to it, laid out like the box, with a marker where it sits.
  useLayoutEffect(() => {
    const element = ref.current;
    const marker = markerRef.current;
    const copy = measureRef.current;
    if (!token || !element || !marker || !copy || !layer) {
      setMenuAt(null);
      return;
    }
    const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || 20;
    const menuWidth = Math.min(MENU_WIDTH, element.offsetWidth);
    const top = element.offsetTop + marker.offsetTop - element.scrollTop + lineHeight + 4;
    const left = element.offsetLeft + Math.min(Math.max(0, marker.offsetLeft - 8), element.offsetWidth - menuWidth);
    // Kept inside the box's own height, so a long prompt scrolled away still shows the menu by its bottom edge.
    setMenuAt({ top: Math.min(top, element.offsetTop + element.offsetHeight + 4), left });
  }, [token, layer, value, scroll]);

  const readToken = (element: HTMLTextAreaElement) => {
    const next = slashTokenAt(element.value, element.selectionStart ?? element.value.length);
    setToken(next);
    if (next?.query !== token?.query) setActive(0);
  };

  const change = (next: string) => {
    // The character lives in the text. Deleting the last copy of the name takes it off.
    for (const character of attachedList) {
      if (mentionsName(value, character.name) && !mentionsName(next, character.name)) {
        if (multiple) onDetach?.(character.id);
        else onClearCharacter();
      }
    }
    onChange(next);
  };

  /** Several characters at once: one more can't be added past the limit, but an attached one can be named again. */
  const blocked = (character: CharacterSummary) => full && !isAttached(character.id);

  const pick = (character: CharacterSummary) => {
    const element = ref.current;
    if (!token || !element || blocked(character)) return;
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
          if (token) setScroll(event.currentTarget.scrollTop);
        }}
        onBlur={() => setToken(null)}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        aria-describedby={attachedList.length > 0 && ranges.length > 0 ? `${listId}-attached` : undefined}
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
      {open && layer ? (
        <div
          ref={measureRef}
          aria-hidden
          style={{ ...layer, height: "auto" }}
          className="pointer-events-none invisible absolute overflow-hidden border-solid border-transparent break-words whitespace-pre-wrap"
        >
          {value.slice(0, token.start)}
          <span ref={markerRef}>/</span>
        </div>
      ) : null}
      {attachedList.length > 0 && ranges.length > 0 ? (
        <span id={`${listId}-attached`} className="sr-only">
          {attachedList.map((character) => character.name).join(", ")} {attachedList.length > 1 ? "are" : "is"} attached to this video.
        </span>
      ) : null}
      {open ? (
        <div
          id={listId}
          role="listbox"
          aria-label="Characters"
          style={menuAt ? { top: menuAt.top, left: menuAt.left, width: Math.min(MENU_WIDTH, layer && typeof layer.width === "number" ? layer.width : MENU_WIDTH) } : undefined}
          className={cn(
            "absolute z-20 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg",
            menuAt ? undefined : "inset-x-0 top-full mt-1",
          )}
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
            <>
              {full ? (
                <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
                  Up to {maxAttached} characters in one video. Delete a name to swap in someone else.
                </p>
              ) : null}
              {matches.map((character, index) => (
                <div
                  key={character.id}
                  id={`${listId}-${character.id}`}
                  role="option"
                  aria-selected={index === active}
                  aria-disabled={blocked(character) || undefined}
                  // Keep focus in the box, so picking does not blur it and close the menu first.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(character)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    "flex min-h-11 items-center gap-2.5 rounded-lg px-2 py-1.5",
                    blocked(character) ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                    index === active ? "bg-accent text-accent-foreground" : undefined,
                  )}
                >
                  <Thumb character={character} />
                  <span className="min-w-0 truncate text-sm font-medium">{character.name}</span>
                  {isAttached(character.id) ? <span className="ml-auto text-xs text-muted-foreground">Attached</span> : null}
                </div>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
