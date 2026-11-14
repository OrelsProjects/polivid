import { CircleAlert, Clapperboard, Coins, PenLine } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { checkAuthorizeRequest, type AuthorizeParams } from "@/lib/mcp/auth/authorize-request";
import { connection } from "next/server";
import { auth } from "@/auth";
import { decideAuthorization } from "./actions";

export const metadata: Metadata = { title: "Connect an agent" };

const GRANTS = [
  { icon: Clapperboard, text: "See your videos, productions, characters, songs and uploads" },
  { icon: PenLine, text: "Plan, make and edit videos for you" },
  { icon: Coins, text: "Spend credits, only after it shows you the price and you agree" },
];

async function Consent({ searchParams }: { searchParams: Promise<AuthorizeParams> }) {
  await connection();
  const params = await searchParams;
  const session = await auth();
  const user = session?.user;
  if (!user?.id) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (typeof value === "string") query.set(key, value);
    redirect(`/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }
  const check = await checkAuthorizeRequest(params);
  if (check.kind === "redirect") redirect(check.url);
  if (check.kind === "fatal") {
    return (
      <AuthCard title="Can't connect this app" subtitle={check.message}>
        <div role="alert" className="flex gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-red-300">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Nothing was shared. Close this tab and try connecting again from the app.</span>
        </div>
      </AuthCard>
    );
  }
  const hidden = { ...params, client_id: check.clientId, redirect_uri: check.redirectUri };
  let host = check.redirectUri;
  try {
    host = new URL(check.redirectUri).host || check.redirectUri;
  } catch {}
  return (
    <AuthCard
      title={`Connect ${check.clientName}`}
      subtitle={`${check.clientName} wants to use PoliVid as ${user.email ?? user.name ?? "you"}.`}
    >
      <ul className="flex flex-col gap-3">
        {GRANTS.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-sm">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10">
              <Icon className="size-4" aria-hidden />
            </span>
            <span className="pt-1.5 leading-snug">{text}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-muted-foreground">
        After approving you go back to <span className="font-medium text-foreground">{host}</span>. You can disconnect it any
        time under Connect agents.
      </p>
      <form action={decideAuthorization} className="flex gap-2">
        {Object.entries(hidden).map(([name, value]) =>
          typeof value === "string" ? <input key={name} type="hidden" name={name} value={value} /> : null,
        )}
        <Button type="submit" name="decision" value="deny" variant="outline" className="h-11 flex-1 rounded-full">
          Cancel
        </Button>
        <Button type="submit" name="decision" value="approve" className="h-11 flex-1 rounded-full bg-white text-black hover:bg-white/85">
          Approve
        </Button>
      </form>
    </AuthCard>
  );
}

export default function AuthorizePage({ searchParams }: { searchParams: Promise<AuthorizeParams> }) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-24 h-96 w-full max-w-sm rounded-3xl" />}>
      <Consent searchParams={searchParams} />
    </Suspense>
  );
}
