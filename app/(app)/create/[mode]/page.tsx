import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Generator } from "@/components/generator";
import { Skeleton } from "@/components/ui/skeleton";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { availableGenerationModelIds } from "@/lib/video/available-models";
import type { GenerationModelId } from "@/lib/video/models";
import { resolveModeTier, videoModeById, VIDEO_MODES, type VideoModeId } from "@/lib/video/modes";

export const generateStaticParams = () => VIDEO_MODES.map((mode) => ({ mode: mode.id }));

export async function generateMetadata({ params }: PageProps<"/create/[mode]">): Promise<Metadata> {
  const { mode } = await params;
  return { title: videoModeById(mode)?.title ?? "Create" };
}

export default async function CreateModePage({ params }: PageProps<"/create/[mode]">) {
  const { mode } = await params;
  const videoMode = videoModeById(mode);
  if (!videoMode) notFound();
  if (videoMode.status !== "live") redirect("/tools");
  const resolved = resolveModeTier(videoMode.id, "pro");
  if (!resolved) redirect("/tools");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <BackLink href="/tools">All tools</BackLink>
      <Suspense fallback={<Skeleton className="h-[720px] rounded-2xl" />}>
        <GeneratorWithMode mode={resolved.mode.id} defaultModel={resolved.model?.id ?? "wan"} />
      </Suspense>
    </div>
  );
}

async function GeneratorWithMode({
  mode,
  defaultModel,
}: {
  mode: VideoModeId;
  defaultModel: GenerationModelId;
}) {
  await connection();
  return (
    <Generator
      demo={!hasOpenRouterKey()}
      defaultModel={defaultModel}
      models={availableGenerationModelIds()}
      mode={mode}
    />
  );
}
