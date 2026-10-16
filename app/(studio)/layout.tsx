import type { ReactNode } from "react";
import { StoreProvider } from "@/components/store-provider";

/**
 * Full-screen studio chrome. The project editor leaves the signed-in app
 * sidebar behind so the timeline can use the whole viewport.
 */
export default function StudioLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="h-svh overflow-hidden bg-background">
      <StoreProvider>{children}</StoreProvider>
    </main>
  );
}
