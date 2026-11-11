"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PlanCardView } from "./studio-ui";

/** The sidebar plan card. A sample screen can swap it (ProjectRecovery shows a low Starter balance). */
type Plan = { name: string; balance: number; low?: boolean };

const PlanContext = createContext<(plan: Plan | null) => void>(() => {});

/** Show `plan` in the sidebar while the calling screen is mounted. */
export function useStudioPlan(plan: Plan) {
  const setPlan = useContext(PlanContext);
  const { name, balance, low } = plan;
  useEffect(() => {
    setPlan({ name, balance, low });
    return () => setPlan(null);
  }, [setPlan, name, balance, low]);
}

const ICON = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  projects: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 4v16M16 4v16" />
    </>
  ),
  tools: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  coach: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.6A8 8 0 1 1 21 12z" />,
  characters: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  billing: (
    <>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </>
  ),
  sources: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>
  ),
  publish: <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />,
  automations: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  brand: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="7.5" r="1.25" />
    </>
  ),
  settings: (
    <>
      <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
      <circle cx="15" cy="6" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

function Icon({ name, size = 18 }: { name: keyof typeof ICON; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON[name]}
    </svg>
  );
}

type NavItem = {
  label: string;
  icon: keyof typeof ICON;
  /** Missing href: shown disabled, as in the design. */
  href?: string;
  /** Path prefixes that mark the item current. `=` prefix means an exact match. */
  activeFor?: readonly string[];
};

const MAIN: readonly NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home", activeFor: ["/dashboard", "=/studio"] },
  {
    href: "/videos",
    label: "Projects",
    icon: "projects",
    activeFor: ["/videos", "/productions", "/editor", "/studio/projects"],
  },
  { href: "/tools", label: "Tools", icon: "tools", activeFor: ["/tools"] },
  { href: "/coach", label: "Coach", icon: "coach", activeFor: ["/coach"] },
  { href: "/studio/sources", label: "Sources", icon: "sources", activeFor: ["/studio/sources"] },
  { href: "/studio/publish", label: "Publish", icon: "publish", activeFor: ["/studio/publish"] },
  { href: "/studio/automations", label: "Automations", icon: "automations", activeFor: ["/studio/automations"] },
];

const WORKSPACE: readonly NavItem[] = [
  { href: "/characters", label: "Characters & voices", icon: "characters", activeFor: ["/characters", "/voices"] },
  { label: "Brand assets", icon: "brand" },
  { href: "/billing", label: "Billing", icon: "billing", activeFor: ["/billing"] },
  { label: "Settings", icon: "settings" },
];

const CREATE_FOR = ["/create", "/studio/create"];

const matches = (pathname: string | null, prefixes: readonly string[] = []) =>
  pathname !== null &&
  prefixes.some((prefix) =>
    prefix.startsWith("=") ? pathname === prefix.slice(1) : pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

/**
 * Signed-in shell: the white Studio sidebar on desktop, a top bar with a menu below md.
 * `plan` and `account` are server-rendered slots for the bottom of the sidebar. Only the
 * pieces that read the pathname sit inside <Suspense>, so the rest of the shell prerenders.
 */
export function StudioFrame({
  plan,
  account,
  children,
}: {
  plan?: ReactNode;
  account?: ReactNode;
  children: ReactNode;
}) {
  const [override, setOverride] = useState<Plan | null>(null);
  const planSlot = override ? (
    <PlanCardView name={override.name} balance={override.balance} low={override.low} badge="Sample" />
  ) : (
    plan
  );

  return (
    <PlanContext.Provider value={setOverride}>
      <div className="flex min-h-svh flex-1 bg-[#F6F6F9] text-[14px] leading-[1.5] text-[#141321]">
        <aside
          aria-label="Studio navigation"
          className="sticky top-0 hidden h-svh w-[248px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-[#E4E4EC] bg-white px-3.5 py-5 md:flex"
        >
          <Brand />
          <Suspense fallback={<CreateButton pathname={null} />}>
            <CurrentCreateButton />
          </Suspense>
          <Suspense fallback={<NavLists pathname={null} />}>
            <CurrentNavLists />
          </Suspense>
          <div className="mt-auto flex flex-col gap-3">
            {planSlot}
            {account}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-[#E4E4EC] bg-white px-4 md:hidden">
            <Brand />
            <Suspense fallback={<MenuButton open={false} onToggle={() => {}} />}>
              <MobileMenu>
                {planSlot}
                {account}
              </MobileMenu>
            </Suspense>
          </header>
          <main id="main" className="flex min-w-0 flex-1 flex-col">
            {children}
          </main>
        </div>
      </div>
    </PlanContext.Provider>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" aria-label="PoliVid home" className="flex items-center gap-2.5 px-2 py-1 text-[#141321]">
      <span
        aria-hidden="true"
        className="inline-flex size-7 items-center justify-center rounded-[8px] bg-[#5B2EE6] font-heading text-[15px] font-bold text-white"
      >
        P
      </span>
      <span className="font-heading text-[17px] font-semibold">PoliVid</span>
    </Link>
  );
}

const CurrentCreateButton = () => <CreateButton pathname={usePathname()} />;

function CreateButton({ pathname }: { pathname: string | null }) {
  const creating = matches(pathname, CREATE_FOR);
  return (
    <Link
      href="/create"
      aria-current={creating ? "page" : undefined}
      className={cn(
        "flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#5B2EE6] text-[14px] font-medium text-white",
        creating && "shadow-[0_0_0_4px_#EFEAFE]",
      )}
    >
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      Create video
    </Link>
  );
}

const CurrentNavLists = () => <NavLists pathname={usePathname()} />;

function NavLists({ pathname }: { pathname: string | null }) {
  return (
    <>
      <nav aria-label="Main" className="flex flex-col gap-0.5">
        {MAIN.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} />
        ))}
      </nav>
      <div className="flex flex-col gap-0.5">
        <div className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-[0.08em] text-[#6B6A7B] uppercase">
          Workspace
        </div>
        {WORKSPACE.map((item) => (
          <NavLink key={item.label} item={item} pathname={pathname} />
        ))}
      </div>
    </>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string | null }) {
  if (!item.href) {
    return (
      <button
        type="button"
        disabled
        className="flex h-10 shrink-0 cursor-not-allowed items-center gap-2.5 rounded-[10px] bg-transparent px-2.5 text-left font-medium text-[#8A8899]"
      >
        <Icon name={item.icon} />
        {item.label}
      </button>
    );
  }
  const active = matches(pathname, item.activeFor);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2.5 rounded-[10px] px-2.5 font-medium",
        active ? "bg-[#EFEAFE] text-[#4A23C9]" : "text-[#3F3D4F] hover:bg-[#F6F6F9]",
      )}
    >
      <Icon name={item.icon} />
      {item.label}
    </Link>
  );
}

const MENU_ID = "studio-mobile-menu";

function MenuButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={MENU_ID}
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={onToggle}
      className="grid size-10 place-items-center rounded-[10px] text-[#3F3D4F] hover:bg-[#F6F6F9]"
    >
      <Icon name={open ? "close" : "menu"} size={20} />
    </button>
  );
}

/** Below md: the same sidebar contents in a panel under the top bar. Closes on navigation and Escape. */
function MobileMenu({ children }: { children: ReactNode }) {
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

  return (
    <>
      <MenuButton open={open} onToggle={() => setOpen((current) => !current)} />
      {open ? (
        <div
          id={MENU_ID}
          className="absolute inset-x-0 top-full z-30 flex max-h-[calc(100svh-3.5rem)] flex-col gap-5 overflow-y-auto border-b border-[#E4E4EC] bg-white px-3.5 py-4"
        >
          <CreateButton pathname={pathname} />
          <NavLists pathname={pathname} />
          <div className="flex flex-col gap-3 border-t border-[#E4E4EC] pt-4">{children}</div>
        </div>
      ) : null}
    </>
  );
}
