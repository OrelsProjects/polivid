"use client";

import { Heart, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CreatePresetDialog } from "@/components/create-preset-dialog";
import { PresetPoster } from "@/components/preset-poster";
import { cn } from "@/lib/utils";
import {
  AUTO_PRESET,
  listPresetsFor,
  type GenerationPreset,
} from "@/lib/video/presets";

const FAVORITES_KEY = "polivid:preset-favorites";

export interface CustomPresetTile {
  id: string;
  name: string;
  tagline: string;
  promptFragment: string;
  poster: GenerationPreset["poster"];
}

const readFavorites = () => {
  if (typeof window === "undefined") return [] as string[];
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};

export function PresetPicker({
  engine,
  value,
  onChange,
  customPresets,
  onCreated,
  disabled,
  hideCreate,
}: {
  engine: "footage" | "motion";
  value: string;
  onChange: (id: string) => void;
  customPresets?: CustomPresetTile[];
  onCreated?: (preset: CustomPresetTile) => void;
  disabled?: boolean;
  hideCreate?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

  const catalog = listPresetsFor(engine);
  const tiles = useMemo(() => {
    const extras: GenerationPreset[] = (customPresets ?? []).map((preset) => ({
      ...AUTO_PRESET,
      id: preset.id,
      name: preset.name,
      tagline: preset.tagline,
      promptFragment: preset.promptFragment,
      poster: preset.poster,
      family: "realism",
      appliesTo: "both",
    }));
    const haystack = [...catalog, ...extras];
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? haystack.filter(
          (preset) =>
            preset.name.toLowerCase().includes(needle) ||
            preset.tagline.toLowerCase().includes(needle) ||
            preset.bestFor.some((item) => item.toLowerCase().includes(needle)),
        )
      : haystack;
    return [...filtered].sort((left, right) => {
      const leftFav = favorites.includes(left.id) ? 0 : 1;
      const rightFav = favorites.includes(right.id) ? 0 : 1;
      if (leftFav !== rightFav) return leftFav - rightFav;
      if (left.id === "auto") return -1;
      if (right.id === "auto") return 1;
      return 0;
    });
  }, [catalog, customPresets, favorites, query]);

  const handleFavorite = (id: string) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      } catch {
        // Private mode. Favorites still work for this visit.
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={disabled}
            placeholder="Search presets…"
            aria-label="Search presets"
            className="h-9 w-full rounded-xl border border-input bg-background pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </label>
        {!hideCreate && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setCreating(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-border px-3 text-sm font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-3.5" aria-hidden />
            Create preset
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{tiles.length} styles</p>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pt-1 pb-2" role="listbox" aria-label="Generation presets">
        {tiles.map((preset) => {
          const selected = value === preset.id;
          const favorited = favorites.includes(preset.id);
          return (
            <div key={preset.id} className="flex w-28 shrink-0 flex-col gap-2 sm:w-32">
              <div className="relative">
                <button
                  type="button"
                  role="option"
                  aria-label={preset.name}
                  aria-selected={selected}
                  disabled={disabled}
                  onClick={() => onChange(preset.id)}
                  className="w-full cursor-pointer rounded-2xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <PresetPoster preset={preset} selected={selected} />
                </button>
                <button
                  type="button"
                  aria-pressed={favorited}
                  aria-label={favorited ? `Unfavourite ${preset.name}` : `Favourite ${preset.name}`}
                  disabled={disabled}
                  onClick={() => handleFavorite(preset.id)}
                  className="absolute top-2 right-2 grid size-7 cursor-pointer place-items-center rounded-full bg-black/35 text-white hover:bg-black/50 disabled:opacity-50"
                >
                  <Heart className={cn("size-3.5", favorited && "fill-white")} />
                </button>
              </div>
              <div>
                <p className="truncate text-sm font-medium">{preset.name}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{preset.tagline}</p>
              </div>
            </div>
          );
        })}
      </div>
      {!hideCreate && (
        <CreatePresetDialog
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(preset) => {
            onCreated?.(preset);
            onChange(preset.id);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
