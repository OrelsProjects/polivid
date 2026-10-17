import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex cursor-pointer items-center gap-2 text-foreground", className)}>
      <Image
        src="/brand/polivid-icon-1024.png"
        alt=""
        width={56}
        height={56}
        priority
        className="size-7 rounded-[7px] shadow-[0_2px_10px_-2px_rgb(88_28_180/0.7)] ring-1 ring-white/20"
      />
      <span className="font-heading text-[17px] font-bold tracking-tight">PoliVid</span>
    </Link>
  );
}
