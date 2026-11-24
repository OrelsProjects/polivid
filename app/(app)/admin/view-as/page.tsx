import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { realAuth } from "@/auth";
import { ViewAsPicker } from "@/components/admin/view-as-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { isAdminEmail } from "@/lib/auth/view-as";

export const metadata: Metadata = { title: "View as a user" };

export default function ViewAsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">View as a user</h1>
        <p className="text-sm text-muted-foreground">
          See and use the app exactly as they do: their videos, characters, credits, and drafts. Anything you do acts on
          their account, including spending their credits. A banner stays on screen until you stop.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <AdminOnly />
      </Suspense>
    </div>
  );
}

/** Admins only, checked against who is really signed in. */
async function AdminOnly() {
  const session = await realAuth();
  if (!isAdminEmail(session?.user?.email)) notFound();
  return <ViewAsPicker />;
}
