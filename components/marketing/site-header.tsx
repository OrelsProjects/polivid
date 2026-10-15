"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#showcase", label: "Showcase" },
  { href: "#tools", label: "Tools" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
] as const;

const MENU_ID = "site-menu";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleToggle = () => setOpen((current) => !current);
  const handleClose = () => setOpen(false);

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Page">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="cursor-pointer rounded-md transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden cursor-pointer rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted sm:inline"
          >
            Sign in
          </Link>
          <Link href="/create" className={cn(buttonVariants({ size: "lg" }), "h-10 rounded-xl px-4")}>
            Try for free
          </Link>
          <button
            type="button"
            className="grid size-10 cursor-pointer place-items-center rounded-xl text-foreground transition-colors hover:bg-muted md:hidden"
            aria-expanded={open}
            aria-controls={MENU_ID}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={handleToggle}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav id={MENU_ID} className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden" aria-label="Page">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={handleClose}
              className="rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-muted"
            >
              {link.label}
            </a>
          ))}
          <Link href="/login" onClick={handleClose} className="rounded-lg px-3 py-2.5 text-sm hover:bg-muted">
            Sign in
          </Link>
        </nav>
      )}
    </header>
  );
}
