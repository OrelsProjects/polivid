"use client";

import {
  Clapperboard,
  CreditCard,
  Film,
  Images,
  LayoutGrid,
  LayoutTemplate,
  MessageCircle,
  Plus,
  Settings,
  Sparkles,
  UserRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { SlidingPill } from "@/components/motion/motion";
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
    href: "/coach",
    label: "Coach",
    icon: MessageCircle,
    activeFor: ["/coach"],
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
  { href: "/characters", label: "Characters", icon: UserRound, activeFor: ["/characters"] },
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

export function AppNav({
  showCreate = true,
  scope = "sidebar",
}: {
  showCreate?: boolean;
  /** Keeps the sliding highlight separate when two navs are mounted. */
  scope?: "sidebar" | "drawer";
}) {
  return (
    <div className="flex flex-col gap-1">
      {showCreate && (
        <Link
          href="/create"
          className={cn(
            buttonVariants({ size: "lg" }),
            "mb-3 h-10 w-full rounded-xl glow-accent",
          )}
        >
          <Plus data-icon="inline-start" />
          New video
        </Link>
      )}
      {/* On routes with request-time params the pathname is unknown while prerendering, so links render unhighlighted until it resolves. */}
      <Suspense fallback={<NavLinks pathname={null} scope={scope} />}>
        <CurrentNavLinks scope={scope} />
      </Suspense>
    </div>
  );
}

const CurrentNavLinks = ({ scope }: { scope: "sidebar" | "drawer" }) => (
  <NavLinks pathname={usePathname()} scope={scope} />
);

const NavLinks = ({ pathname, scope }: { pathname: string | null; scope: "sidebar" | "drawer" }) => (
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
            "relative flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors",
            active
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
          )}
        >
          {active ? (
            <SlidingPill layoutId={`app-nav-${scope}`} className="rounded-xl bg-sidebar-accent ring-1 ring-white/[0.06]" />
          ) : null}
          <Icon
            className={cn("relative z-10 size-4", active && "text-primary")}
            aria-hidden
          />
          <span className="relative z-10">{item.label}</span>
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
        <span className="ml-auto rounded-md bg-white/[0.06] px-1.5 py-0.5 font-label text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
          Soon
        </span>
      </span>
    ))}
  </nav>
);
