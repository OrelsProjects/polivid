import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { SongVoiceTest } from "@/components/characters/song-voice-test";

export const metadata: Metadata = { title: "Song voice test" };

export default function SongVoiceTestPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-3">
        <BackLink href="/characters">Characters</BackLink>
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Song voice test</h1>
          <p className="text-sm text-muted-foreground">
            Hear a short song sung in a character&apos;s voice before you spend credits on a video.
          </p>
        </div>
      </div>
      <SongVoiceTest />
    </div>
  );
}
