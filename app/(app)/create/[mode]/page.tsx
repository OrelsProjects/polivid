import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Generator } from "@/components/generator";
import { Skeleton } from "@/components/ui/skeleton";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { availableGenerationModelIds } from "@/lib/video/available-models";
import { resolveModeTier, videoModeById, VIDEO_MODES } from "@/lib/video/modes";

export const generateStaticParams = () => VIDEO_MODES.map((mode) => ({ mode: mode.id }));

export async function generateMetadata({ params }: PageProps<"/create/[mode]">): Promise<Metadata> {
  const { mode } = await params;
  return { title: videoModeById(mode)?.title ?? "Create" };
}

export default function CreateModePage({ params }: PageProps<"/create/[mode]">) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <BackLink href="/tools">All tools</BackLink>
      <Suspense fallback={<Skeleton className="h-[720px] rounded-2xl" />}>
        <CreateModeGenerator params={params} />
      </Suspense>
    </div>
  );
}

async function CreateModeGenerator({ params }: Pick<PageProps<"/create/[mode]">, "params">) {
  const { mode } = await params;
  const videoMode = videoModeById(mode);
  if (!videoMode) notFound();
  if (videoMode.status !== "live") redirect("/tools");
  const resolved = resolveModeTier(videoMode.id, "pro");
  if (!resolved) redirect("/tools");

  await connection();
  return (
    <Generator
      demo={!hasOpenRouterKey()}
      defaultModel={resolved.model?.id ?? "wan"}
      models={availableGenerationModelIds()}
      mode={resolved.mode.id}
    />
  );
}
