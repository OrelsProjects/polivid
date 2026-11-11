import type { ReactNode } from "react";
import { connection } from "next/server";
import { getBalance } from "@/lib/billing/credits";
import { getCurrentUser } from "@/lib/session";
import { AccountMenu } from "./account-menu";
import { CreditsPill } from "./studio-ui";

/** Top bar slots for the signed-in account. Both read the session, so render them inside <Suspense>. */

export async function StudioPlanCard() {
  await connection();
  const user = await getCurrentUser();
  const balance = await getBalance(user.id);
  return (
    <CreditsPill
      balance={balance.total}
      action={{ href: "/billing", label: balance.plan === "free" ? "Upgrade" : "Manage" }}
    />
  );
}

export async function StudioAccount({ footer }: { footer?: ReactNode }) {
  const user = await getCurrentUser();
  const label = user.name ?? user.email ?? "Signed in";
  return (
    <AccountMenu
      label={label}
      detail={user.name && user.email ? user.email : "Workspace owner"}
      image={user.image}
      footer={footer}
    />
  );
}

export const PlanCardFallback = () => <div className="h-[52px] w-36 rounded-2xl border border-border bg-card" />;
export const AccountFallback = () => <div className="size-11 rounded-full bg-muted" />;
