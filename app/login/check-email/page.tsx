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
        <Mail className="size-8 text-primary" />
        <p>Open the link on this device to sign in. It expires in 24 hours.</p>
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Use a different email
        </Link>
      </div>
    </AuthCard>
  );
}
