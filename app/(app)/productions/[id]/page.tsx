import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductionWorkspace } from "@/components/production/production-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyProduction } from "@/lib/production/store";

export const metadata: Metadata = { title: "Production" };

export default function ProductionPage({ params }: PageProps<"/productions/[id]">) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-8">
      <Suspense fallback={<Skeleton className="h-[640px] rounded-2xl" />}>
        {params.then(({ id }) => (
          <ProductionLoader id={id} />
        ))}
      </Suspense>
    </div>
  );
}

async function ProductionLoader({ id }: { id: string }) {
  const production = await getMyProduction(id);
  if (!production) notFound();
  return <ProductionWorkspace initial={production} />;
}
