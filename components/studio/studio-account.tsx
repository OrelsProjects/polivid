import { LogOut } from "lucide-react";
import { connection } from "next/server";
import { signOutAction } from "@/app/login/actions";
import { getBalance } from "@/lib/billing/credits";
import { planById } from "@/lib/billing/plans";
import { getCurrentUser } from "@/lib/session";
import { PlanCardView } from "./studio-ui";

/** Sidebar slots for the signed-in account. Both read the session, so render them inside <Suspense>. */

export async function StudioPlanCard() {
  await connection();
  const user = await getCurrentUser();
  const balance = await getBalance(user.id);
  const plan = planById(balance.plan);
  return (
    <PlanCardView
      name={`${plan.name} plan`}
      balance={balance.total}
      action={{ href: "/billing", label: balance.plan === "free" ? "Upgrade" : "Manage" }}
    />
  );
}

export async function StudioAccount() {
  const user = await getCurrentUser();
  const label = user.name ?? user.email ?? "Signed in";
  return (
    <div className="flex items-center gap-2.5 px-1.5">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatar from Google, tiny
        <img src={user.image} alt="" className="size-8 shrink-0 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[#FFE2CF] text-[13px] font-semibold text-[#9A3B00]"
        >
          {label.charAt(0).toUpperCase()}
        </span>
      )}
      <div className="flex min-w-0 flex-1 flex-col leading-[1.25]">
        <span className="truncate text-[13px] font-medium">{label}</span>
        <span className="truncate text-[12px] text-[#6B6A7B]">{user.name && user.email ? user.email : "Workspace owner"}</span>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="grid size-8 place-items-center rounded-[8px] text-[#6B6A7B] hover:bg-[#F6F6F9] hover:text-[#141321]"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}

export const PlanCardFallback = () => <div className="h-[70px] rounded-[14px] border border-[#E4E4EC] bg-[#FAFAFC]" />;
export const AccountFallback = () => <div className="h-8" />;
