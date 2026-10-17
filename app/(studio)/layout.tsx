import { Suspense, type ReactNode } from "react";
import { PageTransition } from "@/components/motion/motion";
import { StoreProvider } from "@/components/store-provider";

/**
 * Full-screen studio chrome. The project editor leaves the signed-in app
 * sidebar behind so the timeline can use the whole viewport.
 */
export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="h-svh overflow-hidden bg-background">
      <StoreProvider>
        <Suspense fallback={<div className="h-svh bg-background" />}>
          <PageTransition distance={0} className="h-svh overflow-hidden">
            {children}
          </PageTransition>
        </Suspense>
      </StoreProvider>
    </main>
  );
}
