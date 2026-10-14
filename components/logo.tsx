import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}>
      <span className="grid size-7 place-items-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">
        P
      </span>
      <span>PoliVid</span>
    </Link>
  );
}
