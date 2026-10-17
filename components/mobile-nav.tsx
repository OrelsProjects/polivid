"use client";

import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { AnimatePresence } from "motion/react";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { AppNav } from "@/components/app-nav";
import { DropPanel } from "@/components/motion/motion";

const PANEL_ID = "mobile-app-nav";

/** Menu button plus drop-down panel for the signed-in shell below the md breakpoint. */
export function MobileNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedOn, setOpenedOn] = useState(pathname);

  if (pathname !== openedOn) {
    setOpenedOn(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleToggle = () => setOpen((current) => !current);

  const handlePanelClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={PANEL_ID}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={handleToggle}
        className="grid size-10 cursor-pointer place-items-center rounded-xl text-foreground transition-colors hover:bg-muted"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>
      <AnimatePresence>
        {open ? (
          <DropPanel
            key="app-menu"
            id={PANEL_ID}
            onClick={handlePanelClick}
            className="absolute inset-x-0 top-full z-30 max-h-[calc(100svh-4rem)] overflow-y-auto border-b border-sidebar-border bg-sidebar px-3 pt-3 pb-4 shadow-lg"
          >
            <AppNav showCreate={false} scope="drawer" />
            <div className="mt-4 flex flex-col gap-3 border-t border-sidebar-border pt-4">{children}</div>
          </DropPanel>
        ) : null}
      </AnimatePresence>
    </>
  );
}
