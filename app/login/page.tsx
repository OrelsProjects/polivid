import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { authErrorMessage, LoginForm } from "@/components/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { safeCallbackUrl } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-24 h-80 w-full max-w-sm rounded-3xl" />}>
      {searchParams.then((params) => {
        const callbackUrl = safeCallbackUrl(params.callbackUrl);
        const message = authErrorMessage(typeof params.error === "string" ? params.error : null);
        const saved = callbackUrl.startsWith("/create");
        return (
          <AuthCard
            title="Sign in"
            subtitle={
              saved
                ? "Your prompt is saved. Sign in and we'll take you straight to it."
                : "Your first sign-in creates your account. No credit card required."
            }
            notice={
              message ? (
                <div
                  role="alert"
                  className="flex w-full gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{message}</span>
                </div>
              ) : null
            }
          >
            <LoginForm callbackUrl={callbackUrl} />
          </AuthCard>
        );
      })}
    </Suspense>
  );
}
