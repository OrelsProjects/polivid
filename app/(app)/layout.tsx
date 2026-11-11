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
 * Shell for signed-in pages: the white Studio sidebar on desktop, a top bar with a menu on mobile.
 * proxy.ts redirects signed-out visitors to /login before this renders.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <StudioFrame
      plan={
        <>
          <Suspense fallback={<PlanCardFallback />}>
            <StudioPlanCard />
          </Suspense>
          <Suspense fallback={null}>
            <EngineStatus />
          </Suspense>
        </>
      }
      account={
        <Suspense fallback={<AccountFallback />}>
          <StudioAccount />
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
    <p className="px-1.5 text-[12px] text-[#6B6A7B]" title={MODEL}>
      LIVE · {generationModelBySlug(MODEL)?.name ?? DEFAULT_GENERATION_MODEL.name}
    </p>
  ) : (
    <p className="px-1.5 text-[12px] text-[#6B6A7B]">
      Demo mode. Videos use fictional sample data until an API key is set.
    </p>
  );
}
