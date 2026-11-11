// FOR DELETION: Unused leftover of the first Studio preview. Not linked from the Studio sidebar. See "For deletion" in docs/STUDIO.md.
import type { Metadata } from "next";
import Link from "next/link";
import { CharacterLibrary } from "@/components/characters/character-library";

export const metadata: Metadata = { title: "Characters & voices" };

export default function StudioCharactersPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <p role="note" className="rounded-xl border border-[#E4E4EC] bg-white px-3 py-2 text-sm text-[#3F3D4F]">
        Real account. Characters and voices here are your saved library, not sample data.
      </p>
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Characters & voices</h1>
        <p className="mt-1 text-sm text-[#6B6A7B]">
          Give each character a name and a picture. Add a voice if you want them to narrate.
        </p>
        <Link href="/characters/song-test" className="mt-2 inline-flex text-sm font-medium text-[#4A23C9] hover:underline">
          Test a character singing
        </Link>
      </div>
      <CharacterLibrary />
    </div>
  );
}
