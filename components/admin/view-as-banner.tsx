import { auth } from "@/auth";
import type { ViewAsSession } from "@/lib/auth/view-as-session";
import { StopViewingButton } from "./stop-viewing-button";

/**
 * Shown on every signed-in page while an admin views the app as someone else, so it is never
 * mistaken for their own account. Everything done here acts on that person's account.
 */
export async function ViewAsBanner() {
  const session = (await auth()) as ViewAsSession | null;
  if (!session?.viewAs || !session.user) return null;
  const who = session.user.name || session.user.email || "this user";
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-3 z-[60] mx-auto flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-2xl border border-amber-400/40 bg-amber-500 px-4 py-2 text-sm font-medium text-black shadow-lg"
    >
      <span>
        Viewing as <strong>{who}</strong>
        {session.user.name && session.user.email ? <span className="font-normal"> · {session.user.email}</span> : null}
        <span className="font-normal"> · anything you do acts on their account</span>
      </span>
      <StopViewingButton />
    </div>
  );
}
