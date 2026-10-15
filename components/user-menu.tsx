import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/login/actions";
import { getCurrentUser } from "@/lib/session";

/** Sidebar footer: who is signed in, plus sign-out. Reads the session, so render it inside <Suspense>. */
export async function UserMenu() {
  const user = await getCurrentUser();
  const label = user.name ?? user.email ?? "Signed in";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2 px-1">
      {user.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote avatar from Google, tiny
        <img src={user.image} alt="" className="size-8 rounded-full" referrerPolicy="no-referrer" />
      ) : (
        <span className="grid size-8 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-800">
          {initial}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium">{label}</div>
        {user.name && user.email && <div className="truncate text-[11px] text-muted-foreground">{user.email}</div>}
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="grid size-9 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-white hover:text-foreground"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
