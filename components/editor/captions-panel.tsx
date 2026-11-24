"use client";

import { Captions, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CAPTION_FONTS, fontWeights } from "@/lib/editor/caption-fonts";
import {
  addTimedCaptions,
  applyCaptionPreset,
  CAPTION_CATEGORIES,
  CAPTION_PRESETS,
  currentCaptionStyle,
  styleAllCaptions,
  type CaptionCategory,
  type CaptionPreset,
} from "@/lib/editor/caption-presets";
import { isCaption, removeCaptionsEdit } from "@/lib/editor/coach-edits";
import { textBoxStyle } from "@/lib/editor/layout-box";
import type { TextStyle } from "@/lib/editor/schema";
import { cn } from "@/lib/utils";
import { FPS } from "@/lib/video/schema";
import { CaptionText } from "./composition/caption-text";
import { loadFont } from "./composition/use-fonts";
import { useEditorActions, useEditorProjectId, useEditorTimeline } from "./editor-provider";

const SAMPLE = ["Try", "it", "now", "and", "see", "how"];
/** Frames each sample word takes, and the pause before the sample starts over. */
const WORD_FRAMES = 9;
const LOOP_FRAMES = SAMPLE.length * WORD_FRAMES + 24;
/** Tiles are drawn at this share of the real caption size. */
const TILE_SCALE = 0.34;

/** One clock for every tile, so a grid of previews costs one animation frame, not one each. */
const useLoopFrame = () => {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    let id = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setFrame(Math.floor(((now - start) / 1000) * FPS) % LOOP_FRAMES);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);
  return frame;
};

/** The words a tile shows at `frame`: the line holding the word being said, as the preset cuts lines. */
const sampleLine = (preset: CaptionPreset, frame: number) => {
  const spoken = Math.min(SAMPLE.length - 1, Math.floor(frame / WORD_FRAMES));
  const start = Math.floor(spoken / preset.maxWords) * preset.maxWords;
  const words = SAMPLE.slice(start, start + preset.maxWords);
  return {
    text: words.join(" "),
    durationInFrames: words.length * WORD_FRAMES,
    words: words.map((text, index) => ({ text, from: index * WORD_FRAMES, to: (index + 1) * WORD_FRAMES })),
    local: frame - start * WORD_FRAMES,
  };
};

function PresetTile({
  preset,
  frame,
  selected,
  onPick,
}: {
  preset: CaptionPreset;
  frame: number;
  selected: boolean;
  onPick: () => void;
}) {
  const line = sampleLine(preset, frame);
  const style: TextStyle = {
    ...preset.style,
    fontSize: 72 * preset.scale * TILE_SCALE,
    ...(preset.style.outline ? { outline: { ...preset.style.outline, width: Math.max(1, preset.style.outline.width * TILE_SCALE) } } : {}),
    ...(preset.style.radius ? { radius: preset.style.radius * TILE_SCALE } : {}),
  };
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      title={preset.name}
      className={cn(
        "relative flex h-24 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-gradient-to-b from-zinc-800 to-zinc-950 px-2 ring-offset-2 ring-offset-card transition hover:ring-2 hover:ring-primary/50",
        selected && "ring-2 ring-primary",
      )}
    >
      {preset.isNew ? (
        <span className="absolute top-1.5 left-1.5 rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">New</span>
      ) : null}
      <span style={{ ...textBoxStyle(style), maxWidth: "100%", padding: style.background ? "4px 8px" : 0 }}>
        <CaptionText item={{ text: line.text, words: line.words, durationInFrames: line.durationInFrames, style }} frame={line.local} />
      </span>
      <span className="absolute right-0 bottom-1 left-0 text-center text-[9px] text-neutral-400">{preset.name}</span>
    </button>
  );
}

const POSITIONS = [
  { label: "Top", y: -30 },
  { label: "Middle", y: 0 },
  { label: "Bottom", y: 28 },
];

/**
 * Caption looks for the open edit. Presets restyle every caption at once and, when the captions
 * know when each word is said, re-cut them into lines of the preset's length. Custom changes one
 * part of the look. With no captions yet, the speech of the video this edit came from is timed
 * word by word and captioned.
 */
export function CaptionsPanel() {
  const timeline = useEditorTimeline();
  const projectId = useEditorProjectId();
  const actions = useEditorActions();
  const frame = useLoopFrame();
  const [view, setView] = useState<"presets" | "custom">("presets");
  const [category, setCategory] = useState<CaptionCategory | "all">("all");
  const [picked, setPicked] = useState("yellow-pop");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCaptions = useMemo(() => timeline.tracks.some((track) => track.items.some(isCaption)), [timeline]);
  const current = currentCaptionStyle(timeline);
  const presets = CAPTION_PRESETS.filter((preset) => category === "all" || preset.categories.includes(category));

  useEffect(() => {
    for (const font of CAPTION_FONTS) void loadFont(font);
  }, []);

  const apply = (change: () => typeof timeline) => {
    setError(null);
    try {
      actions.applyTimeline(change());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't change the captions.");
    }
  };

  const pick = (id: string) => {
    setPicked(id);
    if (hasCaptions) apply(() => applyCaptionPreset(timeline, id));
  };

  const addCaptions = async () => {
    if (!projectId || adding) return;
    setAdding(true);
    setError(null);
    try {
      const response = await fetch(`/api/editor/projects/${projectId}/captions`, { method: "POST" });
      const reply = (await response.json().catch(() => null)) as { words?: { text: string; start: number; end: number }[]; error?: string } | null;
      if (!response.ok || !reply?.words) throw new Error(reply?.error ?? "Couldn't add captions.");
      actions.applyTimeline(addTimedCaptions(timeline, reply.words, picked, FPS));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't add captions.");
    } finally {
      setAdding(false);
    }
  };

  const style = current?.style;
  const restyle = (patch: Partial<TextStyle>, y?: number) => apply(() => styleAllCaptions(timeline, patch, y));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(["presets", "custom"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            aria-pressed={view === entry}
            onClick={() => setView(entry)}
            className={cn(
              "rounded-lg py-1.5 text-xs font-medium capitalize",
              view === entry ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {entry}
          </button>
        ))}
      </div>

      {!hasCaptions ? (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">This edit has no captions yet. Pick a look, then add them. They are timed to the words in your video.</p>
          <Button type="button" onClick={() => void addCaptions()} disabled={adding || !projectId}>
            <Captions data-icon="inline-start" />
            {adding ? "Listening…" : "Add captions"}
          </Button>
        </div>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {view === "presets" ? (
        <>
          <div className="flex flex-wrap gap-1">
            {[{ id: "all" as const, label: "All" }, ...CAPTION_CATEGORIES].map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={category === entry.id}
                onClick={() => setCategory(entry.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-medium",
                  category === entry.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-3">
            {presets.map((preset) => (
              <PresetTile key={preset.id} preset={preset} frame={frame} selected={picked === preset.id} onPick={() => pick(preset.id)} />
            ))}
          </div>
        </>
      ) : style ? (
        <div className="flex flex-col gap-3 text-xs">
          <label className="flex items-center justify-between gap-2">
            Font
            <select
              value={CAPTION_FONTS.find((font) => style.fontFamily.includes(font.family))?.stack ?? style.fontFamily}
              onChange={(event) => {
                const weights = fontWeights(event.target.value);
                restyle({ fontFamily: event.target.value, fontWeight: weights.includes(style.fontWeight) ? style.fontWeight : weights.at(-1)! });
              }}
              className="h-8 w-40 rounded-lg border border-border bg-background px-2"
            >
              {!CAPTION_FONTS.some((font) => style.fontFamily.includes(font.family)) ? <option value={style.fontFamily}>System</option> : null}
              {CAPTION_FONTS.map((font) => (
                <option key={font.family} value={font.stack}>
                  {font.family}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            Weight
            <select
              value={style.fontWeight}
              onChange={(event) => restyle({ fontWeight: Number(event.target.value) })}
              className="h-8 w-40 rounded-lg border border-border bg-background px-2"
            >
              {fontWeights(style.fontFamily).map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center justify-between gap-2">
            Size
            <input
              type="number"
              min={12}
              max={200}
              value={Math.round(style.fontSize)}
              onChange={(event) => restyle({ fontSize: Math.max(12, Math.min(200, Number(event.target.value) || style.fontSize)) })}
              className="h-8 w-40 rounded-lg border border-border bg-background px-2"
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            Text color
            <input type="color" value={style.color.startsWith("#") ? style.color.slice(0, 7) : "#ffffff"} onChange={(event) => restyle({ color: event.target.value })} className="h-8 w-40 rounded-lg border border-border bg-background" />
          </label>
          <label className="flex items-center justify-between gap-2">
            Spoken word
            <span className="flex w-40 items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(style.activeWord?.color)}
                onChange={(event) => restyle({ activeWord: event.target.checked ? { ...style.activeWord, color: "#FFD400" } : undefined })}
              />
              {style.activeWord?.color ? (
                <input type="color" value={style.activeWord.color.slice(0, 7)} onChange={(event) => restyle({ activeWord: { ...style.activeWord, color: event.target.value } })} className="h-8 flex-1 rounded-lg border border-border bg-background" />
              ) : (
                <span className="text-muted-foreground">Off</span>
              )}
            </span>
          </label>
          <label className="flex items-center justify-between gap-2">
            Capitals
            <input type="checkbox" checked={Boolean(style.uppercase)} onChange={(event) => restyle({ uppercase: event.target.checked || undefined })} />
          </label>
          <label className="flex items-center justify-between gap-2">
            Outline
            <input
              type="checkbox"
              checked={Boolean(style.outline)}
              onChange={(event) => restyle({ outline: event.target.checked ? { color: "#000000", width: 8 } : undefined })}
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            Box behind
            <span className="flex w-40 items-center gap-2">
              <input type="checkbox" checked={Boolean(style.background)} onChange={(event) => restyle({ background: event.target.checked ? "rgba(0,0,0,0.6)" : null, radius: event.target.checked ? 16 : undefined })} />
              {style.background ? <span className="text-muted-foreground">On</span> : <span className="text-muted-foreground">Off</span>}
            </span>
          </label>
          <div className="flex items-center justify-between gap-2">
            Position
            <div className="flex w-40 gap-1">
              {POSITIONS.map((position) => (
                <button
                  key={position.label}
                  type="button"
                  aria-pressed={current?.y === position.y}
                  onClick={() => restyle({}, position.y)}
                  className={cn("flex-1 rounded-lg border px-1 py-1", current?.y === position.y ? "border-primary text-primary" : "border-border text-muted-foreground")}
                >
                  {position.label}
                </button>
              ))}
            </div>
          </div>
          <Button type="button" variant="ghost" className="justify-start text-destructive" onClick={() => apply(() => removeCaptionsEdit(timeline).timeline)}>
            <Trash2 data-icon="inline-start" />
            Remove captions
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Add captions first, then change their look here.</p>
      )}
    </div>
  );
}
