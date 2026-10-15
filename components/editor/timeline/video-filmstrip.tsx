"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { frameForTime, loadFilmstrip, type LoadedFilmstrip } from "@/lib/editor/filmstrip";
import { useSquareTiles } from "./use-square-tiles";

const MAX_CANVAS_WIDTH = 16_384;
const EMPTY_TILE = "#262626";
const TILE_EDGE = "rgba(0, 0, 0, 0.35)";

type DrawArgs = {
  canvas: HTMLCanvasElement;
  filmstrip: LoadedFilmstrip | null;
  width: number;
  tile: number;
  startSeconds: number;
  durationSeconds: number;
};

/** Tiles are pinned to source time, so trimming the start slides frames instead of reshuffling them. */
const drawFilmstrip = ({ canvas, filmstrip, width, tile, startSeconds, durationSeconds }: DrawArgs) => {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_CANVAS_WIDTH / Math.max(1, width));
  canvas.width = Math.max(1, Math.ceil(width * pixelRatio));
  canvas.height = Math.max(1, Math.ceil(tile * pixelRatio));
  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.fillStyle = EMPTY_TILE;
  context.fillRect(0, 0, width, tile);
  if (!filmstrip || durationSeconds <= 0) return;

  const pixelsPerSecond = width / durationSeconds;
  const startPixel = startSeconds * pixelsPerSecond;
  const firstTile = Math.floor(startPixel / tile);
  context.fillStyle = TILE_EDGE;
  for (let index = firstTile; ; index += 1) {
    const x = index * tile - startPixel;
    if (x >= width) break;
    const frame = frameForTime(filmstrip, ((index + 0.5) * tile) / pixelsPerSecond);
    context.drawImage(filmstrip.image, frame * filmstrip.tile, 0, filmstrip.tile, filmstrip.tile, x, 0, tile, tile);
    context.fillRect(x + tile - 1, 0, 1, tile);
  }
};

export function VideoFilmstrip({
  src,
  startSeconds,
  durationSeconds,
  width,
}: {
  src: string;
  startSeconds: number;
  durationSeconds: number;
  width: number;
}) {
  const { ref, tile } = useSquareTiles(width);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [filmstrip, setFilmstrip] = useState<LoadedFilmstrip | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadFilmstrip(src).then((next) => {
      if (!cancelled) setFilmstrip(next);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawFilmstrip({ canvas, filmstrip, width, tile, startSeconds, durationSeconds });
  }, [durationSeconds, filmstrip, startSeconds, tile, width]);

  return (
    <div ref={ref} className="pointer-events-none h-full w-full overflow-hidden" aria-hidden>
      <canvas ref={canvasRef} className="block h-full" style={{ width }} />
    </div>
  );
}
