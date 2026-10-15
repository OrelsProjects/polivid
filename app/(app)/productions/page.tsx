import { ChevronRight } from "lucide-react";
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
    return (
      <p className="rounded-2xl border border-dashed border-border bg-white p-10 text-center text-sm text-muted-foreground">
        No productions yet. Describe an idea above to plan your first one.
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">Your productions</h2>
      <ul className="flex flex-col gap-2">
        {productions.map((production) => (
          <li key={production.id}>
            <Link
              href={`/productions/${production.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3 text-sm shadow-sm transition hover:border-primary/30 hover:shadow-md"
            >
              <span className="min-w-0 flex-1 truncate font-medium">{production.title}</span>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {STATUS_LABEL[production.status] ?? production.status}
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">
                {production.targetDurationSec}s
              </span>
              <ChevronRight
                className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
