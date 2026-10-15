import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { AppNav } from "@/components/app-nav";
import { PlanCard } from "@/components/billing/plan-card";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { hasOpenRouterKey, MODEL } from "@/lib/ai/openrouter";
import { DEFAULT_GENERATION_MODEL, generationModelBySlug } from "@/lib/video/models";

/**
 * Shell for signed-in pages: sidebar on desktop, top nav on mobile.
 * proxy.ts redirects signed-out visitors to /login before this renders.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 bg-background">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4 md:flex">
        <Logo href="/dashboard" className="px-2 pt-1" />
        <div className="mt-5">
          <AppNav />
        </div>
        <div className="mt-auto flex flex-col gap-3">
          <Suspense fallback={<div className="h-16 rounded-2xl border border-border bg-white" />}>
            <PlanCard />
          </Suspense>
          <Suspense fallback={null}>
            <EngineStatus />
          </Suspense>
          <Suspense fallback={<div className="h-10" />}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-sidebar px-4 py-3 md:hidden">
          <Logo href="/dashboard" />
          <AppNav orientation="horizontal" />
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Reads env at request time so adding a key takes effect without a rebuild. */
async function EngineStatus() {
  await connection();
  return hasOpenRouterKey() ? (
    <p className="px-1 text-xs leading-relaxed text-muted-foreground" title={MODEL}>
      {hasOpenRouterKey() ? "LIVE" : "DEMO"} · {generationModelBySlug(MODEL)?.name ?? DEFAULT_GENERATION_MODEL.name}
    </p>
  ) : (
    <p className="px-1 text-xs leading-relaxed text-muted-foreground">
      Demo mode. Videos use fictional sample data until an API key is set.
    </p>
  );
}
