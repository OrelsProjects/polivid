"use client";

import {
  Clapperboard,
  CreditCard,
  Film,
  Images,
  LayoutGrid,
  LayoutTemplate,
  Plus,
  Settings,
  Sparkles,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  /** Path prefixes that mark this item as the current page. Empty means never active. */
  activeFor: readonly string[];
};

const NAV: readonly NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutGrid,
    activeFor: ["/dashboard"],
  },
  {
    href: "/tools",
    label: "Tools",
    icon: Wrench,
    activeFor: ["/tools", "/create/"],
  },
  {
    href: "/productions",
    label: "Productions",
    icon: Sparkles,
    activeFor: ["/productions"],
  },
  { href: "/videos", label: "My videos", icon: Film, activeFor: ["/videos"] },
  {
    href: "/editor",
    label: "Editor",
    icon: Clapperboard,
    activeFor: ["/editor"],
  },
  {
    href: "/billing",
    label: "Billing",
    icon: CreditCard,
    activeFor: ["/billing"],
  },
  {
    href: "/dashboard#showcase",
    label: "Showcase",
    icon: Images,
    activeFor: [],
  },
];

const SOON = [
  { label: "Templates", icon: LayoutTemplate },
  { label: "Settings", icon: Settings },
] as const;

const isActive = (pathname: string | null, item: NavItem) =>
  pathname !== null &&
  item.activeFor.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`),
  );

export function AppNav({ showCreate = true }: { showCreate?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      {showCreate && (
        <Link
          href="/create"
          className={cn(
            buttonVariants({ size: "lg" }),
            "mb-3 h-10 w-full rounded-xl",
          )}
        >
          <Plus data-icon="inline-start" />
          New video
        </Link>
      )}
      {/* On routes with request-time params the pathname is unknown while prerendering, so links render unhighlighted until it resolves. */}
      <Suspense fallback={<NavLinks pathname={null} />}>
        <CurrentNavLinks />
      </Suspense>
    </div>
  );
}

const CurrentNavLinks = () => <NavLinks pathname={usePathname()} />;

const NavLinks = ({ pathname }: { pathname: string | null }) => (
  <nav className="flex flex-col gap-1" aria-label="App">
    {NAV.map((item) => {
      const active = isActive(pathname, item);
      const Icon = item.icon;
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
            active
              ? "bg-white font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-white/70 hover:text-foreground",
          )}
        >
          <Icon
            className={cn("size-4", active && "text-primary")}
            aria-hidden
          />
          {item.label}
        </Link>
      );
    })}
    {SOON.map(({ label, icon: Icon }) => (
      <span
        key={label}
        className="flex min-h-10 items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground/70"
      >
        <Icon className="size-4" aria-hidden />
        {label}
        <span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
          SOON
        </span>
      </span>
    ))}
  </nav>
);
