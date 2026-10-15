"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#showcase", label: "Showcase" },
  { href: "#tools", label: "Tools" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  const handleToggle = () => setOpen((current) => !current);
  const handleClose = () => setOpen(false);

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex" aria-label="Page">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href} className="cursor-pointer transition hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden cursor-pointer px-3 py-2 text-sm text-foreground sm:inline">
            Sign in
          </Link>
          <Link href="/create" className={cn(buttonVariants({ size: "lg" }), "h-10 rounded-xl px-4")}>
            Try for free
          </Link>
          <button
            type="button"
            className="grid size-10 cursor-pointer place-items-center rounded-xl text-foreground md:hidden"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={handleToggle}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="flex flex-col gap-1 border-t border-border px-4 py-3 md:hidden" aria-label="Page">
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
