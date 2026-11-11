"use client";

import {
  Box,
  Captions,
  FolderOpen,
  House,
  ImagePlay,
  LayoutGrid,
  Link2,
  Menu,
  MessageSquare,
  Music,
  Plus,
  Send,
  Smartphone,
  UserRound,
  Video,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  Suspense,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { CreditsPill } from "./studio-ui";

/** The credits pill. A sample screen can swap it (ProjectRecovery shows a low Starter balance). */
type Plan = { name: string; balance: number; low?: boolean };

const PlanContext = createContext<(plan: Plan | null) => void>(() => {});

/** Show `plan` in the top bar while the calling screen is mounted. */
export function useStudioPlan(plan: Plan) {
  const setPlan = useContext(PlanContext);
  const { name, balance, low } = plan;
  useEffect(() => {
    setPlan({ name, balance, low });
    return () => setPlan(null);
  }, [setPlan, name, balance, low]);
}

let nightScopes = 0;

/**
 * Puts the app palette on <html> while a signed-in shell is mounted. Menus and dialogs
 * render outside the shell, so the class on the shell's own root does not reach them.
 */
export function ThemeScope() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    nightScopes += 1;
    root.classList.add("night");
    return () => {
      nightScopes -= 1;
      if (nightScopes === 0) root.classList.remove("night");
    };
  }, []);
  return null;
}

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Path prefixes that mark the item current. `=` prefix means an exact match. */
  activeFor: readonly string[];
};

const RAIL: readonly NavItem[] = [
  { href: "/coach", label: "Coach", icon: MessageSquare, activeFor: ["/coach"] },
  { href: "/create/image", label: "Image to Video", icon: ImagePlay, activeFor: ["/create/image"] },
  { href: "/create", label: "Create video", icon: Video, activeFor: ["/create", "/studio/create"] },
  { href: "/create/music", label: "Music to Video", icon: Music, activeFor: ["/create/music", "/create/lyrics"] },
  { href: "/create/shorts", label: "Shorts / TikToks", icon: Smartphone, activeFor: ["/create/shorts"] },
  { href: "/create/motion-graphics", label: "Motion graphics", icon: Box, activeFor: ["/create/motion-graphics"] },
  { href: "/create/captions", label: "Add captions", icon: Captions, activeFor: ["/create/captions"] },
  { href: "/characters", label: "Characters & voices", icon: UserRound, activeFor: ["/characters", "/voices"] },
  { href: "/studio/sources", label: "Sources", icon: Link2, activeFor: ["/studio/sources"] },
  { href: "/studio/publish", label: "Publish", icon: Send, activeFor: ["/studio/publish"] },
  { href: "/studio/automations", label: "Automations", icon: Workflow, activeFor: ["/studio/automations"] },
  { href: "/tools", label: "All tools", icon: LayoutGrid, activeFor: ["/tools"] },
];

const HOME: NavItem = { href: "/dashboard", label: "Home", icon: House, activeFor: ["/dashboard", "=/studio"] };

const MEDIA: NavItem = {
  href: "/videos",
  label: "Media",
  icon: FolderOpen,
  activeFor: ["/videos", "/productions", "/editor", "/studio/projects"],
};

const ALL_ITEMS: readonly NavItem[] = [...RAIL, HOME, MEDIA];

/** How much of the path a prefix claims. Zero when it does not match. */
const claim = (pathname: string, prefix: string) => {
  if (prefix.startsWith("=")) return pathname === prefix.slice(1) ? prefix.length + 1000 : 0;
  return pathname === prefix || pathname.startsWith(`${prefix}/`) ? prefix.length : 0;
};

/** The one item that is current: the longest prefix wins, so /create/shorts lights Shorts, not Create. */
const currentHref = (pathname: string | null) => {
  if (!pathname) return null;
  let best: { href: string; score: number } | null = null;
  for (const item of ALL_ITEMS) {
    const score = Math.max(0, ...item.activeFor.map((prefix) => claim(pathname, prefix)));
    if (score > 0 && (!best || score > best.score)) best = { href: item.href, score };
  }
  return best?.href ?? null;
};

const PILL = "rounded-2xl border border-border bg-card/90 backdrop-blur-md";

/**
 * Signed-in shell: a floating top bar with the brand, an icon rail, and the account.
 * `plan` and `account` are server-rendered slots for the right side. Only the pieces that
 * read the pathname sit inside <Suspense>, so the rest of the shell prerenders.
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
  const planSlot = override ? <CreditsPill balance={override.balance} low={override.low} badge="Sample" /> : plan;

  return (
    <PlanContext.Provider value={setOverride}>
      <ThemeScope />
      <div className="night flex min-h-svh flex-1 flex-col bg-background text-[14px] leading-[1.5] text-foreground">
        <header className="pointer-events-none sticky top-0 z-30 px-3 pt-3 sm:px-5 sm:pt-5">
          <div className="relative grid grid-cols-[1fr_auto] items-center gap-2 lg:grid-cols-[1fr_auto_1fr]">
            <div className="pointer-events-auto flex items-center gap-2 justify-self-start">
              <Brand />
              <Suspense fallback={<CreateButton current={null} />}>
                <CurrentCreateButton />
              </Suspense>
            </div>

            <Suspense fallback={<Rail current={null} />}>
              <CurrentRail />
            </Suspense>

            <div className="pointer-events-auto flex items-center gap-2 justify-self-end">
              <Suspense fallback={<MediaLink current={null} />}>
                <CurrentMediaLink />
              </Suspense>
              {planSlot}
              {account}
              <Suspense fallback={<MenuButton open={false} onToggle={() => {}} />}>
                <MobileMenu />
              </Suspense>
            </div>
          </div>
        </header>
        <main id="main" className="flex min-w-0 flex-1 flex-col">
          {children}
        </main>
      </div>
    </PlanContext.Provider>
  );
}

function Brand() {
  return (
    <Link
      href="/dashboard"
      aria-label="PoliVid home"
      className={cn(PILL, "flex h-[52px] items-center gap-2.5 py-0 pr-4 pl-2 text-foreground")}
    >
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-[10px] bg-foreground text-[20px] font-bold text-background"
      >
        P
      </span>
      <span className="hidden text-[15px] font-semibold sm:inline">PoliVid</span>
    </Link>
  );
}

const useCurrent = () => currentHref(usePathname());

const CurrentCreateButton = () => <CreateButton current={useCurrent()} />;

function CreateButton({ current }: { current: string | null }) {
  const creating = current === "/create";
  return (
    <Link
      href="/create"
      aria-label="Create video"
      aria-current={creating ? "page" : undefined}
      className={cn(
        PILL,
        "flex h-[52px] items-center gap-2 px-4 text-[15px] font-medium text-foreground hover:bg-accent",
        creating && "border-input bg-accent",
      )}
    >
      <Plus className="size-5" aria-hidden />
      <span className="hidden min-[1360px]:inline">Create</span>
    </Link>
  );
}

const CurrentRail = () => <Rail current={useCurrent()} />;

function Rail({ current }: { current: string | null }) {
  return (
    <nav
      aria-label="Main"
      className={cn(PILL, "pointer-events-auto hidden h-[52px] items-center gap-0.5 px-1.5 lg:flex")}
    >
      {RAIL.map((item) => (
        <RailLink key={item.href} item={item} active={current === item.href} />
      ))}
      <span aria-hidden="true" className="mx-1.5 h-[22px] w-px bg-input" />
      <RailLink item={HOME} active={current === HOME.href} />
    </nav>
  );
}

function RailLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative grid size-11 shrink-0 place-items-center rounded-xl transition-colors",
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-full left-1/2 z-10 mt-2.5 -translate-x-1/2 rounded-lg border border-border bg-popover px-2.5 py-1 text-[12px] font-medium whitespace-nowrap text-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {item.label}
      </span>
    </Link>
  );
}

const CurrentMediaLink = () => <MediaLink current={useCurrent()} />;

function MediaLink({ current }: { current: string | null }) {
  const active = current === MEDIA.href;
  return (
    <Link
      href={MEDIA.href}
      aria-label="Media"
      aria-current={active ? "page" : undefined}
      className={cn(
        PILL,
        "hidden h-[52px] items-center gap-2 px-4 text-[15px] font-medium text-muted-foreground hover:text-foreground sm:flex",
        active && "border-input text-foreground",
      )}
    >
      <FolderOpen className="size-[18px] text-amber-200/80" aria-hidden />
      <span className="hidden min-[1360px]:inline">Media</span>
    </Link>
  );
}

const MENU_ID = "studio-mobile-menu";

function MenuButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const Icon = open ? X : Menu;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={MENU_ID}
      aria-label={open ? "Close menu" : "Open menu"}
      onClick={onToggle}
      className={cn(PILL, "grid size-[52px] place-items-center text-foreground lg:hidden")}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

/** Below lg: every destination with its name, in a panel under the bar. Closes on navigation and Escape. */
function MobileMenu() {
  const pathname = usePathname();
  const current = currentHref(pathname);
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
      <MenuButton open={open} onToggle={() => setOpen((value) => !value)} />
      {open ? (
        <nav
          id={MENU_ID}
          aria-label="Main"
          className="absolute inset-x-0 top-full z-30 mt-2 flex max-h-[calc(100svh-6rem)] flex-col gap-0.5 overflow-y-auto rounded-2xl border border-border bg-popover p-2 lg:hidden"
        >
          {[HOME, ...RAIL, MEDIA].map((item) => {
            const Icon = item.icon;
            const active = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-3 rounded-xl px-3 font-medium",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </>
  );
}
