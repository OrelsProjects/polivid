import type { Metadata } from "next";
import Link from "next/link";
import { CharacterLibrary } from "@/components/characters/character-library";

export const metadata: Metadata = { title: "Characters" };

export default function CharactersPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Characters</h1>
        <p className="text-sm text-muted-foreground">
          Give each character a name and a picture. Add a voice if you want them to narrate. Then pick them on a video.
        </p>
        <Link
          href="/characters/song-test"
          className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          Test a character singing
        </Link>
      </div>
      <CharacterLibrary />
    </div>
  );
}
