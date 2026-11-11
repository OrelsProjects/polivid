import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { PageTransition } from "@/components/motion/motion";
import { StoreProvider } from "@/components/store-provider";
import {
  AccountFallback,
  PlanCardFallback,
  StudioAccount,
  StudioPlanCard,
} from "@/components/studio/studio-account";
import { StudioFrame } from "@/components/studio/studio-frame";
import { hasOpenRouterKey, MODEL } from "@/lib/ai/openrouter";
import {
  DEFAULT_GENERATION_MODEL,
  generationModelBySlug,
} from "@/lib/video/models";

/**
 * Shell for signed-in pages: a floating top bar with an icon rail, and a menu button on small screens.
 * proxy.ts redirects signed-out visitors to /login before this renders.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <StudioFrame
      plan={
        <Suspense fallback={<PlanCardFallback />}>
          <StudioPlanCard />
        </Suspense>
      }
      account={
        <Suspense fallback={<AccountFallback />}>
          <StudioAccount
            footer={
              <Suspense fallback={null}>
                <EngineStatus />
              </Suspense>
            }
          />
        </Suspense>
      }
    >
      <StoreProvider>
        <PageTransition>{children}</PageTransition>
      </StoreProvider>
    </StudioFrame>
  );
}

/** Reads env at request time so adding a key takes effect without a rebuild. */
async function EngineStatus() {
  await connection();
  return hasOpenRouterKey() ? (
    <span title={MODEL}>Live · {generationModelBySlug(MODEL)?.name ?? DEFAULT_GENERATION_MODEL.name}</span>
  ) : (
    <span>Demo mode. Videos use fictional sample data until an API key is set.</span>
  );
}
