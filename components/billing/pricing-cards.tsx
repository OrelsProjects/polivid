"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  formatUsdFromCents,
  PLANS,
  yearlyPerMonthCents,
  type BillingInterval,
  type PlanId,
} from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export function PricingCards({
  mode,
  currentPlan = "free",
  highlightedPlan,
}: {
  mode: "marketing" | "app";
  currentPlan?: PlanId;
  highlightedPlan?: PlanId;
}) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (planId: Exclude<PlanId, "free">) => {
    setBusy(planId);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "plan", plan: planId, interval }),
      });
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !body?.url) {
        throw new Error(body?.error ?? "Couldn't start checkout.");
      }
      window.location.assign(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't start checkout.");
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto flex rounded-xl bg-muted p-1" role="tablist" aria-label="Billing interval">
        {(["month", "year"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={interval === value}
            onClick={() => setInterval(value)}
            className={cn(
              "cursor-pointer rounded-lg px-4 py-1.5 text-sm font-medium transition",
              interval === value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "month" ? "Monthly" : "Yearly"}
            {value === "year" && <span className="ml-1.5 text-xs text-primary">save ~16%</span>}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-center text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const current = plan.id === currentPlan;
          const highlight = plan.popular || plan.id === highlightedPlan;
          const price =
            plan.id === "free"
              ? "Free"
              : interval === "year"
                ? `${formatUsdFromCents(yearlyPerMonthCents(plan.yearlyCents))}/mo`
                : `${formatUsdFromCents(plan.monthlyCents)}/mo`;
          const billed =
            plan.id === "free"
              ? "100 trial credits"
              : interval === "year"
                ? `${formatUsdFromCents(plan.yearlyCents)} billed yearly`
                : `${plan.credits.toLocaleString()} credits / month`;
          const href = plan.id === "free" ? "/create" : `/billing?plan=${plan.id}`;
          return (
            <article
              key={plan.id}
              className={cn(
                "flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm",
                highlight ? "border-primary ring-1 ring-primary/20" : "border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                </div>
                {plan.popular && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-primary">
                    Most popular
                  </span>
                )}
              </div>
              <p>
                <span className="text-3xl font-semibold tracking-tight">{price}</span>
                {plan.id !== "free" && interval === "year" && (
                  <span className="ml-1 text-sm text-muted-foreground">equivalent</span>
                )}
              </p>
              <p className="text-sm text-muted-foreground">{billed}</p>
              <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              {mode === "marketing" ? (
                <Link
                  href={href}
                  className={cn(buttonVariants({ variant: highlight ? "default" : "outline" }), "mt-auto h-10 rounded-xl")}
                >
                  {plan.id === "free" ? "Try for free" : "Choose plan"}
                </Link>
              ) : current ? (
                <Button type="button" variant="outline" disabled className="mt-auto h-10 rounded-xl">
                  Current plan
                </Button>
              ) : plan.id === "free" ? (
                <Link href="/create" className={cn(buttonVariants({ variant: "outline" }), "mt-auto h-10 rounded-xl")}>
                  Keep free credits
                </Link>
              ) : (
                <Button
                  type="button"
                  variant={highlight ? "default" : "outline"}
                  disabled={busy !== null}
                  onClick={() => {
                    if (plan.id === "free") return;
                    void handleCheckout(plan.id);
                  }}
                  className="mt-auto h-10 rounded-xl"
                >
                  {busy === plan.id ? "Redirecting…" : currentPlan === "free" ? "Subscribe" : "Switch plan"}
                </Button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
