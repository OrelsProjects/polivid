import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PricingCards } from "@/components/billing/pricing-cards";
import { TopupPacks } from "@/components/billing/topup-packs";
import { CreditExamples } from "@/components/billing/credit-examples";
import { Skeleton } from "@/components/ui/skeleton";
import { getBalance } from "@/lib/billing/credits";
import { isPlanId, planById } from "@/lib/billing/plans";
import { getCurrentUser } from "@/lib/session";
import { ManageBillingButton } from "./manage-button";

export const metadata: Metadata = { title: "Billing" };

type BillingSearchParams = Promise<{ plan?: string; status?: string }>;

export default function BillingPage({
  searchParams,
}: {
  searchParams: BillingSearchParams;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plans refill monthly. Boost credits never expire.
        </p>
      </div>

      <Suspense fallback={<BillingAccountSkeleton />}>
        <BillingAccount searchParams={searchParams} />
      </Suspense>
      <TopupPacks signedIn />
      <CreditExamples />
    </div>
  );
}

const BillingAccountSkeleton = () => (
  <>
    <Skeleton className="h-28 rounded-2xl" />
    <Skeleton className="h-[480px] rounded-2xl" />
  </>
);

async function BillingAccount({
  searchParams,
}: {
  searchParams: BillingSearchParams;
}) {
  await connection();
  const user = await getCurrentUser();
  const balance = await getBalance(user.id);
  const query = await searchParams;
  const highlighted =
    query.plan && isPlanId(query.plan) ? query.plan : undefined;
  const plan = planById(balance.plan);
  const refill = balance.creditsRefillAt
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(
        balance.creditsRefillAt,
      )
    : null;

  return (
    <>
      {query.status === "success" && (
        <p
          className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary"
          role="status"
        >
          Payment received. Credits show up as soon as Stripe confirms the
          charge.
        </p>
      )}
      {query.status === "cancel" && (
        <p
          className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground"
          role="status"
        >
          Checkout was canceled. Your current plan is unchanged.
        </p>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-primary">
              CURRENT PLAN
            </p>
            <h2 className="mt-1 text-xl font-semibold">{plan.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {balance.total.toLocaleString()} credits ·{" "}
              {balance.planCredits.toLocaleString()} plan ·{" "}
              {balance.bonusCredits.toLocaleString()} bonus
              {refill ? ` · refills ${refill}` : ""}
            </p>
          </div>
          {balance.stripeCustomerId && <ManageBillingButton />}
        </div>
      </section>

      <PricingCards
        mode="app"
        currentPlan={balance.plan}
        highlightedPlan={highlighted}
      />
    </>
  );
}
