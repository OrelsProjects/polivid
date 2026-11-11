import { Suspense, type ReactNode } from "react";
import { StoreProvider } from "@/components/store-provider";
import {
  AccountFallback,
  PlanCardFallback,
  StudioAccount,
  StudioPlanCard,
} from "@/components/studio/studio-account";
import { StudioFrame } from "@/components/studio/studio-frame";

export default function PreviewStudioLayout({ children }: { children: ReactNode }) {
  return (
    <StudioFrame
      plan={
        <Suspense fallback={<PlanCardFallback />}>
          <StudioPlanCard />
        </Suspense>
      }
      account={
        <Suspense fallback={<AccountFallback />}>
          <StudioAccount />
        </Suspense>
      }
    >
      <StoreProvider>
        <div className="flex flex-col px-4 pt-6 pb-12 sm:px-10 sm:pt-7">
          <Suspense fallback={<p className="text-sm text-[#6B6A7B]">Loading…</p>}>{children}</Suspense>
        </div>
      </StoreProvider>
    </StudioFrame>
  );
}
