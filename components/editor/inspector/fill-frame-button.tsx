"use client";

import { Button } from "@/components/ui/button";
import type { Transform } from "@/lib/editor/schema";

const fillsFrame = ({ x, y, scale, rotation }: Transform) => x === 0 && y === 0 && scale === 1 && rotation === 0;

export function FillFrameButton({
  transform,
  onChange,
}: {
  transform: Transform;
  onChange: (transform: Transform) => void;
}) {
  if (fillsFrame(transform)) return null;

  const handleClick = () => onChange({ ...transform, x: 0, y: 0, scale: 1, rotation: 0 });

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label="Reset size, position and rotation so the clip fills the frame"
      onClick={handleClick}
    >
      Fill frame
    </Button>
  );
}
