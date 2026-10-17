"use client";

import {
  AnimatePresence,
  motion,
  MotionConfig,
  type HTMLMotionProps,
  type Transition,
  type Variants,
} from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Children,
  createContext,
  Suspense,
  useContext,
  useLayoutEffect,
  useState,
  type ComponentProps,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/** Decelerate on arrival. Exits use a shorter, accelerating curve. */
const enterEase = [0.22, 1, 0.36, 1] as const;
const exitEase = [0.4, 0, 1, 1] as const;

const enterTransition: Transition = { duration: 0.32, ease: enterEase };
const hoverSpring: Transition = { type: "spring", stiffness: 460, damping: 34, mass: 0.65 };
const pressSpring: Transition = { type: "spring", stiffness: 520, damping: 32, mass: 0.55 };
const settleSpring: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.7 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: enterTransition },
};

export const staggerParent = (count: number): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: count > 8 ? 0.03 : 0.045 } },
});

type MotionPreference = "unknown" | "safe" | "reduce";

const MotionSafeContext = createContext<MotionPreference>("unknown");

export const useMotionSafe = () => useContext(MotionSafeContext) === "safe";

/**
 * Honors the OS reduced-motion setting for the whole app.
 * The preference starts unknown so server HTML stays visible. A layout
 * effect resolves it before the first paint, then entrances are allowed to play.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<MotionPreference>("unknown");

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setPreference(media.matches ? "reduce" : "safe");
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <MotionSafeContext.Provider value={preference}>{children}</MotionSafeContext.Provider>
    </MotionConfig>
  );
}

export function PageTransition({
  children,
  distance = 8,
  className = "flex min-w-0 flex-1 flex-col",
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  return (
    <Suspense fallback={<div className={className}>{children}</div>}>
      <PathTransition distance={distance} className={className}>
        {children}
      </PathTransition>
    </Suspense>
  );
}

function PathTransition({
  children,
  distance,
  className,
}: {
  children: ReactNode;
  distance: number;
  className: string;
}) {
  const pathname = usePathname();
  const safe = useMotionSafe();
  const duration = distance === 0 ? 0.16 : 0.28;

  return (
    <motion.div
      key={`${pathname}-${safe ? "play" : "rest"}`}
      className={className}
      initial={safe ? { opacity: 0, y: distance } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={safe ? { duration, ease: enterEase } : { duration: 0 }}
    >
      {children}
    </motion.div>
  );
}

/** Mount animation for a single block, such as the sign-in card or hero copy. */
export function Rise({
  children,
  className,
  delay = 0,
  y = 12,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const safe = useMotionSafe();
  return (
    <motion.div
      key={safe ? "play" : "rest"}
      className={className}
      initial={safe ? { opacity: 0, y } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={safe ? { duration: 0.36, delay, ease: enterEase } : { duration: 0 }}
    >
      {children}
    </motion.div>
  );
}

/** Plays once when the block scrolls into view. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 10,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const safe = useMotionSafe();
  return (
    <motion.div
      key={safe ? "play" : "rest"}
      className={className}
      initial={safe ? { opacity: 0, y } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -8% 0px" }}
      transition={safe ? { duration: 0.4, delay, ease: enterEase } : { duration: 0 }}
    >
      {children}
    </motion.div>
  );
}

const staggerParents = {
  div: motion.div,
  ol: motion.ol,
  ul: motion.ul,
  dl: motion.dl,
} as const;

const staggerItems = {
  div: motion.div,
  li: motion.li,
} as const;

/** Staggers direct children. Use on a list or grid, not on every nested node. */
export function Stagger({
  children,
  className,
  itemClassName,
  as = "div",
  item = "div",
  inView = false,
  enter = true,
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  as?: keyof typeof staggerParents;
  item?: keyof typeof staggerItems;
  inView?: boolean;
  /** Skip the entrance when the surrounding page already fades in. */
  enter?: boolean;
}) {
  const safe = useMotionSafe();
  const play = safe && enter;
  const Parent = staggerParents[as];
  const Item = staggerItems[item];
  const count = Children.count(children);

  return (
    <Parent
      key={play ? "play" : "rest"}
      className={className}
      initial={play ? "hidden" : false}
      animate={play && !inView ? "show" : undefined}
      whileInView={play && inView ? "show" : undefined}
      viewport={play && inView ? { once: true, margin: "0px 0px -40px 0px" } : undefined}
      variants={play ? staggerParent(count) : undefined}
    >
      {Children.map(children, (child) => (
        <Item className={itemClassName} variants={play ? fadeUp : undefined}>
          {child}
        </Item>
      ))}
    </Parent>
  );
}

type CardLinkProps = ComponentProps<typeof Link>;

/** Link that lifts a few pixels on hover and presses in on tap. */
export function CardLink({ className, children, ...props }: CardLinkProps) {
  const safe = useMotionSafe();
  return (
    <motion.div
      className="h-full"
      whileHover={safe ? { y: -4 } : undefined}
      whileTap={safe ? { scale: 0.98 } : undefined}
      transition={safe ? { y: hoverSpring, scale: pressSpring } : { duration: 0 }}
    >
      <Link className={cn("h-full", className)} {...props}>
        {children}
      </Link>
    </motion.div>
  );
}

/** Shared highlight that slides between segmented options. */
export function SlidingPill({ layoutId, className }: { layoutId: string; className?: string }) {
  return (
    <motion.span
      layoutId={layoutId}
      aria-hidden
      className={cn("pointer-events-none absolute inset-0", className)}
      transition={settleSpring}
    />
  );
}

export function FilterLink({
  active,
  layoutId,
  pillClassName,
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & {
  active: boolean;
  layoutId: string;
  pillClassName?: string;
}) {
  return (
    <Link className={cn("relative", className)} {...props}>
      {active ? <SlidingPill layoutId={layoutId} className={pillClassName} /> : null}
      <span className="relative z-10">{children}</span>
    </Link>
  );
}

/** Disclosure content. Fades instead of animating height. Closed content unmounts immediately when motion is off. */
export function RevealPanel({
  open,
  children,
  id,
  className,
  role,
  label,
}: {
  open: boolean;
  children: ReactNode;
  id?: string;
  className?: string;
  role?: "region" | "dialog";
  label?: string;
}) {
  const safe = useMotionSafe();
  return (
    <AnimatePresence initial={false}>
      {open ? (
        <motion.div
          id={id}
          role={role}
          aria-label={label}
          className={className}
          initial={safe ? { opacity: 0, y: -6 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={safe ? { opacity: 0, transition: { duration: 0.12, ease: exitEase } } : undefined}
          transition={safe ? { duration: 0.2, ease: enterEase } : { duration: 0 }}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/**
 * Open/close panel that can play an exit. Parent must be the conditional
 * rendered inside AnimatePresence — this element is that panel.
 */
export function DropPanel({
  children,
  className,
  id,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
}) {
  const safe = useMotionSafe();
  return (
    <motion.div
      id={id}
      onClick={onClick}
      className={className}
      initial={safe ? { opacity: 0, y: -8 } : false}
      animate={{ opacity: 1, y: 0 }}
      exit={safe ? { opacity: 0, y: -6, transition: { duration: 0.14, ease: exitEase } } : { opacity: 1 }}
      transition={safe ? { duration: 0.22, ease: enterEase } : { duration: 0 }}
    >
      {children}
    </motion.div>
  );
}

export function SwapText({ value, className }: { value: string; className?: string }) {
  const safe = useMotionSafe();
  return (
    <motion.span
      key={value}
      className={className}
      initial={safe ? { opacity: 0, y: 5 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={safe ? { duration: 0.18, ease: enterEase } : { duration: 0 }}
    >
      {value}
    </motion.span>
  );
}

export function ProgressFill({ value }: { value: number }) {
  const safe = useMotionSafe();
  const scale = Math.max(0, Math.min(100, value)) / 100;
  return (
    <motion.div
      className="h-full w-full origin-left rounded-full bg-primary"
      initial={false}
      animate={{ scaleX: scale }}
      transition={safe ? { type: "spring", stiffness: 140, damping: 24 } : { duration: 0 }}
    />
  );
}

type HoverCardProps = HTMLMotionProps<"article">;

export function HoverCard({ className, children, ...props }: HoverCardProps) {
  const safe = useMotionSafe();
  return (
    <motion.article
      className={className}
      whileHover={safe ? { y: -4, transition: hoverSpring } : undefined}
      {...props}
    >
      {children}
    </motion.article>
  );
}

export function HoverItem({ className, children, ...props }: HTMLMotionProps<"li">) {
  const safe = useMotionSafe();
  return (
    <motion.li
      className={className}
      whileHover={safe ? { y: -4, transition: hoverSpring } : undefined}
      {...props}
    >
      {children}
    </motion.li>
  );
}
