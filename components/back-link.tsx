import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/** "← Section" link shown above a detail page title. */
export const BackLink = ({ href, children }: { href: string; children: ReactNode }) => {
  return (
    <Link
      href={href}
      className="-ml-1 flex w-fit items-center gap-1.5 rounded-lg px-1 py-0.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {children}
    </Link>
  );
};
