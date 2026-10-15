import { Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth-card";

export const metadata: Metadata = { title: "Check your email" };

/** Auth.js sends people here after it emails a magic link (pages.verifyRequest in auth.ts). */
export default function CheckEmailPage() {
  return (
    <AuthCard title="Check your email" subtitle="We sent you a sign-in link.">
      <div className="flex flex-col items-center gap-4 text-center text-sm text-muted-foreground">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Mail className="size-6" aria-hidden />
        </span>
        <p>Open the link on this device to sign in. It expires in 24 hours. Can&apos;t find it? Check your spam folder.</p>
        <Link href="/login" className="rounded-md font-medium text-primary underline-offset-4 hover:underline">
          Use a different email
        </Link>
      </div>
    </AuthCard>
  );
}
