import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { RevealPanel } from "@/components/motion/motion";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_VISUAL_DIRECTION } from "@/lib/video/presets";

export function VisualDirectionField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(Boolean(value));

  return (
    <div className="mt-4 border-t border-border pt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-left text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span>
          Visual direction for the whole video
          <span className="ml-1.5 font-normal text-muted-foreground">Optional</span>
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      <RevealPanel open={open} id={id} className="mt-2">
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value.slice(0, MAX_VISUAL_DIRECTION))}
            disabled={disabled}
            rows={3}
            maxLength={MAX_VISUAL_DIRECTION}
            aria-label="Visual direction for the whole video"
            placeholder="Style, mood, camera, and rules for every scene. Applied when the scenes are written. Not a script or a timeline: the story goes in your prompt."
            className="min-h-20 resize-none rounded-xl bg-background"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Style, mood, camera, and rules for every scene. The story stays in your prompt.
          </p>
      </RevealPanel>
    </div>
  );
}
