"use client";

import { CreditCard, LogOut } from "lucide-react";
import Link from "next/link";
import { useTransition, type ReactNode } from "react";
import { signOutAction } from "@/app/login/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The avatar in the top bar. It opens the account's name, billing, and sign out. */
export function AccountMenu({
  label,
  detail,
  image,
  footer,
}: {
  label: string;
  detail: string;
  image?: string | null;
  /** A short status line under the menu items. */
  footer?: ReactNode;
}) {
  const [leaving, startLeaving] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account, ${label}`}
        className="grid size-11 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full bg-orange-500 text-[15px] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar from Google, tiny
          <img src={image} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          label.charAt(0).toUpperCase()
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-64 p-1.5">
        <div className="flex flex-col px-2.5 py-2 leading-[1.3]">
          <span className="truncate text-sm font-medium">{label}</span>
          <span className="truncate text-xs text-muted-foreground">{detail}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/billing" />} className="gap-2.5 rounded-lg px-2.5 py-2">
          <CreditCard className="size-4" aria-hidden />
          Billing
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={leaving}
          onClick={() => startLeaving(() => signOutAction())}
          className="gap-2.5 rounded-lg px-2.5 py-2"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </DropdownMenuItem>
        {footer ? (
          <>
            <DropdownMenuSeparator />
            <div className="px-2.5 py-2 text-xs text-muted-foreground">{footer}</div>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
