"use client";

import { Clapperboard, CreditCard, Film, Images, LayoutGrid, LayoutTemplate, Plus, Settings, Sparkles, Wrench } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/productions", label: "Productions", icon: Sparkles },
  { href: "/videos", label: "My videos", icon: Film },
  { href: "/editor", label: "Editor", icon: Clapperboard },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard#showcase", label: "Showcase", icon: Images },
] as const;

const SOON = [
  { label: "Templates", icon: LayoutTemplate },
  { label: "Settings", icon: Settings },
] as const;

export function AppNav({ orientation = "vertical" }: { orientation?: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  const vertical = orientation === "vertical";

  return (
    <div className={cn("flex gap-1", vertical ? "flex-col" : "flex-row items-center")}>
      <Link
        href="/create"
        className={cn(buttonVariants({ size: "lg" }), vertical ? "mb-3 h-10 w-full rounded-xl" : "h-9 rounded-xl px-3")}
      >
        <Plus data-icon="inline-start" />
        {vertical ? "New video" : "New"}
      </Link>
      <nav className={cn("flex gap-1", vertical ? "flex-col" : "flex-row")} aria-label="App">
        {NAV.map(({ href, label, icon: Icon }) => {
          const path = href.split("#")[0];
          const active =
            path === "/videos"
              ? pathname.startsWith("/videos")
              : path === "/editor"
                ? pathname.startsWith("/editor")
                :             path === "/tools"
                  ? pathname === "/tools" || pathname.startsWith("/create/")
                  : path === "/productions"
                    ? pathname.startsWith("/productions")
                  : path === "/billing"
                    ? pathname.startsWith("/billing")
                  : pathname === path && !href.includes("#");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-white font-medium text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-white/70 hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {vertical ? label : <span className="sr-only">{label}</span>}
              {!vertical && <span className="hidden lg:inline">{label}</span>}
            </Link>
          );
        })}
        {vertical &&
          SOON.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground/70"
            >
              <Icon className="size-4" aria-hidden />
              {label}
              <span className="ml-auto rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">
                SOON
              </span>
            </span>
          ))}
      </nav>
    </div>
  );
}
