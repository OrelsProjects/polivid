import { Logo } from "@/components/logo";
import { Rise } from "@/components/motion/motion";

/** Centered card shared by the sign-in pages. */
export function AuthCard({
  title,
  subtitle,
  children,
  notice,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  notice?: React.ReactNode;
}) {
  return (
    <main id="main" className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[min(820px,140vw)] -translate-x-1/2 bg-[radial-gradient(closest-side,oklch(0.38_0.18_294/0.5),transparent)]"
      />
      <Rise className="relative flex w-full max-w-[420px] flex-col items-center gap-4">
        <Logo className="text-lg" />
        <div className="flex w-full flex-col gap-5 rounded-3xl border border-white/10 bg-card/80 p-7 shadow-[0_24px_64px_-24px_rgb(0_0_0/0.7)] backdrop-blur-xl">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
        {notice}
      </Rise>
    </main>
  );
}
