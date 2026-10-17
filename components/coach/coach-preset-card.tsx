import { PresetPoster } from "@/components/preset-poster";
import { presetById } from "@/lib/video/presets";

export function CoachPresetCard({
  presetId,
  reason,
}: {
  presetId: string;
  reason?: string;
}) {
  const preset = presetById(presetId);
  if (!preset) return null;
  return (
    <aside className="mt-3 flex gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="w-16 shrink-0">
        <PresetPoster preset={preset} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium">{preset.name}</p>
        <p className="text-xs text-muted-foreground">{preset.tagline}</p>
        {reason && <p className="mt-1 text-xs text-muted-foreground">{reason}</p>}
      </div>
    </aside>
  );
}
