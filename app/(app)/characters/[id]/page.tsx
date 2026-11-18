import type { Metadata } from "next";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { CharacterDetail } from "@/components/characters/character-detail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Character" };

export default function CharacterPage({ params }: PageProps<"/characters/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
      <BackLink href="/characters">Characters</BackLink>
      <Suspense fallback={<Skeleton className="h-[520px] rounded-2xl" />}>
        {params.then(({ id }) => (
          <CharacterDetail id={id} />
        ))}
      </Suspense>
    </div>
  );
}
