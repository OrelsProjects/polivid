// FOR DELETION: Unused leftover of the first Studio preview. Not linked from the Studio sidebar. See "For deletion" in docs/STUDIO.md.
import type { Metadata } from "next";
import BillingPage from "@/app/(app)/billing/page";

export const metadata: Metadata = { title: "Billing" };

export default function StudioBillingPage(props: { searchParams: Promise<{ plan?: string; status?: string }> }) {
  return (
    <div className="flex flex-col gap-4">
      <p role="note" className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground/80">
        Real account. Plans and top-ups on this page are live billing, not sample credits.
      </p>
      <BillingPage {...props} />
    </div>
  );
}
