"use client";

import { useLayoutEffect, useRef, useState } from "react";

const FALLBACK_TILE = 56;

export const useSquareTiles = (width: number) => {
  const ref = useRef<HTMLDivElement>(null);
  const [tile, setTile] = useState(FALLBACK_TILE);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => {
      const height = Math.round(node.getBoundingClientRect().height);
      if (height > 8) setTile((current) => (current === height ? current : height));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const count = Math.max(1, Math.ceil(width / tile));
  return { ref, tile, count };
};
