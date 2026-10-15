import { Sparkles } from "lucide-react";
import { ModeCard, ToolCard } from "@/components/mode-card";
import { VIDEO_MODES } from "@/lib/video/modes";

export function ModeGallery() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <li>
        <ToolCard
          title="Productions"
          description="Develop a script, plan shots, generate, and assemble a finished cut."
          icon={Sparkles}
          tint="from-violet-500 to-indigo-700"
          href="/productions"
        />
      </li>
      {VIDEO_MODES.map((mode) => (
        <li key={mode.id}>
          <ModeCard mode={mode} />
        </li>
      ))}
    </ul>
  );
}
