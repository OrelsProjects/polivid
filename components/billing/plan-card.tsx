import Link from "next/link";
import { connection } from "next/server";
import { getBalance } from "@/lib/billing/credits";
import { planById } from "@/lib/billing/plans";
import { getCurrentUser } from "@/lib/session";

export async function PlanCard() {
  await connection();
  const user = await getCurrentUser();
  const balance = await getBalance(user.id);
  const plan = planById(balance.plan);
  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">{plan.name} plan</span>
        <Link
          href="/billing"
          className="-my-1 -mr-1.5 rounded-lg px-1.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
        >
          {balance.plan === "free" ? "Upgrade" : "Manage"}
        </Link>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground tabular-nums">{balance.total.toLocaleString()}</span> credits left
        {balance.planCredits > 0 && balance.bonusCredits > 0
          ? ` · ${balance.planCredits.toLocaleString()} plan, ${balance.bonusCredits.toLocaleString()} bonus`
          : ""}
      </p>
    </div>
  );
}
