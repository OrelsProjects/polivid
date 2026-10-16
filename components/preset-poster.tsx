"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { presetPosterSrc, type GenerationPreset } from "@/lib/video/presets";

export function PresetPoster({
  preset,
  selected,
  className,
}: {
  preset: Pick<GenerationPreset, "id" | "name" | "poster">;
  selected?: boolean;
  className?: string;
}) {
  const src = presetPosterSrc(preset);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [missingSrc, setMissingSrc] = useState<string | null>(null);
  const loaded = loadedSrc === src;
  const missing = missingSrc === src;
  const showImage = src !== null && loaded && !missing;

  const handleImageRef = useCallback(
    (node: HTMLImageElement | null) => {
      if (!node?.complete || !src) return;
      if (node.naturalWidth > 0) {
        setLoadedSrc(src);
        return;
      }
      setMissingSrc(src);
    },
    [src],
  );

  const handleLoad = () => {
    if (src) setLoadedSrc(src);
  };

  const handleError = () => {
    if (src) setMissingSrc(src);
  };

  return (
    <div
      className={cn(
        "relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-muted shadow-sm",
        selected && "ring-2 ring-primary ring-offset-2",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(160deg, ${preset.poster.from}, ${preset.poster.to})`,
      }}
    >
      {src && !missing && (
        <Image
          ref={handleImageRef}
          src={src}
          alt=""
          fill
          sizes="8rem"
          className={cn("object-cover", !loaded && "opacity-0")}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
      {!showImage && (
        <>
          <span
            className="absolute top-3 left-3 h-0.5 w-6 rounded-full"
            style={{ backgroundColor: preset.poster.accent }}
            aria-hidden
          />
          <span className="absolute right-2 bottom-2 left-2 truncate text-left text-[11px] font-semibold tracking-tight text-white drop-shadow">
            {preset.name}
          </span>
        </>
      )}
    </div>
  );
}
