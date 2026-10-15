import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Generator } from "@/components/generator";
import { Skeleton } from "@/components/ui/skeleton";
import { hasOpenRouterKey, MODEL } from "@/lib/ai/openrouter";
import { availableGenerationModelIds } from "@/lib/video/available-models";
import { generationModelIdForSlug } from "@/lib/video/models";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <Suspense fallback={<Skeleton className="h-[720px] rounded-2xl" />}>
        <GeneratorWithMode />
      </Suspense>
    </div>
  );
}

async function GeneratorWithMode() {
  await connection();
  return (
    <Generator
      demo={!hasOpenRouterKey()}
      defaultModel={generationModelIdForSlug(MODEL)}
      models={availableGenerationModelIds()}
    />
  );
}
