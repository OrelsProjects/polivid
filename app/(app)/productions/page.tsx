import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NewProductionForm } from "@/components/production/new-production-form";
import { Skeleton } from "@/components/ui/skeleton";
import { STATUS_LABEL } from "@/lib/production/progress";
import { listMyProductions } from "@/lib/production/store";

export const metadata: Metadata = { title: "Productions" };

export default function ProductionsPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Productions</h1>
        <p className="text-sm text-muted-foreground">
          Turn an idea, outline, or script into a planned, generated, and assembled video.
        </p>
      </div>
      <NewProductionForm />
      <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
        <ProductionList />
      </Suspense>
    </div>
  );
}

async function ProductionList() {
  const productions = await listMyProductions();
  if (productions.length === 0) {
    return <p className="text-sm text-muted-foreground">No productions yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {productions.map((production) => (
        <li key={production.id}>
          <Link
            href={`/productions/${production.id}`}
            className="flex items-center justify-between rounded-2xl border border-border bg-white px-4 py-3 text-sm hover:border-primary/30"
          >
            <span className="font-medium">{production.title}</span>
            <span className="text-muted-foreground">
              {STATUS_LABEL[production.status] ?? production.status} · {production.targetDurationSec}s
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
