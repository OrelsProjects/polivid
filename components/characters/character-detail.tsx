"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CharacterEditor } from "@/components/characters/character-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useGetCharactersQuery } from "@/lib/store/endpoints/characters";

/** The id in /characters/new, where a character is created. */
export const NEW_CHARACTER_ID = "new";

/**
 * One character's page: the editor for /characters/[id], or a blank one for /characters/new.
 * A new character moves to its own page once saved, so pictures, clips, and a voice can be added next.
 */
export function CharacterDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data: characters, error } = useGetCharactersQuery();
  const backToLibrary = () => router.push("/characters");

  if (id === NEW_CHARACTER_ID) {
    return (
      <CharacterEditor
        character={null}
        onSaved={(saved) => router.replace(`/characters/${saved.id}`)}
        onCancel={backToLibrary}
      />
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {apiErrorMessage(error, "Couldn't load this character.")}
      </p>
    );
  }
  if (!characters) return <Skeleton className="h-[520px] rounded-2xl" />;

  const character = characters.find((item) => item.id === id);
  if (!character) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border bg-card p-6 text-sm">
        <p className="text-muted-foreground">This character isn&apos;t in your library. It may have been deleted.</p>
        <Link href="/characters" className="font-medium text-primary underline-offset-4 hover:underline">
          See your characters
        </Link>
      </div>
    );
  }

  return <CharacterEditor key={character.id} character={character} onSaved={backToLibrary} onCancel={backToLibrary} />;
}
