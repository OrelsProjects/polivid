import { Logo } from "@/components/logo";

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
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="flex w-full max-w-[420px] flex-col items-center gap-4">
        <Logo className="text-lg" />
        <div className="flex w-full flex-col gap-5 rounded-3xl border border-border bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
        {notice}
      </div>
    </main>
  );
}
