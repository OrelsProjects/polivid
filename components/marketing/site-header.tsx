"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { DropPanel } from "@/components/motion/motion";
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
    <header className="sticky top-0 z-30 px-3 pt-3 sm:px-6">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 rounded-full border border-white/10 bg-background/70 pr-2 pl-5 shadow-[0_8px_32px_-12px_rgb(0_0_0/0.6)] backdrop-blur-xl">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex" aria-label="Page">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="cursor-pointer rounded-full px-3 py-1.5 transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link
            href="/login"
            className="hidden cursor-pointer rounded-full px-3 py-2 text-sm text-foreground transition-colors hover:bg-white/5 sm:inline"
          >
            Sign in
          </Link>
          <Link href="/create" className={cn(buttonVariants({ size: "lg" }), "h-10 rounded-full px-4 glow-ring bg-transparent text-foreground hover:bg-glow/15")}>
            Start free
            <ArrowRight data-icon="inline-end" />
          </Link>
          <button
            type="button"
            className="grid size-10 cursor-pointer place-items-center rounded-full text-foreground transition-colors hover:bg-white/5 md:hidden"
            aria-expanded={open}
            aria-controls={MENU_ID}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={handleToggle}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open ? (
          <DropPanel key="site-menu">
            <nav
              id={MENU_ID}
              className="mx-auto mt-2 flex max-w-5xl flex-col gap-1 rounded-3xl border border-white/10 bg-popover/95 p-3 backdrop-blur-xl md:hidden"
              aria-label="Page"
            >
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
          </DropPanel>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
