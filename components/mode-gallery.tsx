import { ModeCard } from "@/components/mode-card";
import { VIDEO_MODES } from "@/lib/video/modes";

export function ModeGallery() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {VIDEO_MODES.map((mode) => (
        <li key={mode.id}>
          <ModeCard mode={mode} />
        </li>
      ))}
    </ul>
  );
}
