import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/back-link";
import { Generator } from "@/components/generator";
import { Skeleton } from "@/components/ui/skeleton";
import { hasOpenRouterKey } from "@/lib/ai/openrouter";
import { availableGenerationModelIds } from "@/lib/video/available-models";
import { resolveModeTier } from "@/lib/video/modes";
import { isToolLive, liveTools, toolBySlug } from "@/lib/video/tool-catalog";

/** The segment is a catalog tool slug. Every mode id is also a tool slug. */
export const generateStaticParams = () => liveTools().map((tool) => ({ mode: tool.slug }));

export async function generateMetadata({ params }: PageProps<"/create/[mode]">): Promise<Metadata> {
  const { mode } = await params;
  return { title: toolBySlug(mode)?.title ?? "Create" };
}

export default function CreateModePage({ params }: PageProps<"/create/[mode]">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <BackLink href="/tools">All tools</BackLink>
      <Suspense fallback={<Skeleton className="h-[720px] rounded-2xl" />}>
        <CreateModeGenerator params={params} />
      </Suspense>
    </div>
  );
}

async function CreateModeGenerator({ params }: Pick<PageProps<"/create/[mode]">, "params">) {
  const { mode: slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();
  if (!isToolLive(tool)) redirect("/tools");
  const resolved = resolveModeTier(tool.mode, tool.defaults?.tier ?? "pro");
  if (!resolved) redirect("/tools");

  await connection();
  return (
    <Generator
      key={tool.slug}
      demo={!hasOpenRouterKey()}
      defaultModel={resolved.model?.id ?? "wan"}
      models={availableGenerationModelIds()}
      mode={resolved.mode.id}
      tool={tool.slug}
    />
  );
}
