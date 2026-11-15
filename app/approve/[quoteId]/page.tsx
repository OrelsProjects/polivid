import { CircleAlert, CircleCheck, CircleX, Coins } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { auth } from "@/auth";
import { AuthCard } from "@/components/auth-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getBalance } from "@/lib/billing/credits";
import { getQuoteForUser } from "@/lib/mcp/confirm";
import { MCP_TOOLS } from "@/lib/mcp/tool-list";
import { decideQuote } from "./actions";

export const metadata: Metadata = { title: "Approve a video" };

interface Props {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ error?: string }>;
}

function Notice({ tone, children }: { tone: "ok" | "bad" | "muted"; children: React.ReactNode }) {
  const Icon = tone === "ok" ? CircleCheck : tone === "bad" ? CircleAlert : CircleX;
  const color =
    tone === "ok"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : tone === "bad"
        ? "border-destructive/30 bg-destructive/10 text-red-300"
        : "border-white/10 bg-white/5 text-muted-foreground";
  return (
    <div role="status" className={`flex gap-2 rounded-2xl border px-4 py-3 text-sm ${color}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

async function Approval({ params, searchParams }: Props) {
  await connection();
  const [{ quoteId }, { error }] = await Promise.all([params, searchParams]);
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/login?callbackUrl=${encodeURIComponent(`/approve/${quoteId}`)}`);

  const quote = /^[a-f0-9]{64}$/.test(quoteId) ? await getQuoteForUser(userId, quoteId) : null;
  if (!quote) {
    return (
      <AuthCard title="Quote not found" subtitle="This link isn't for your account, or the quote was removed.">
        <Link href="/videos" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full")}>
          Go to your videos
        </Link>
      </AuthCard>
    );
  }

  const definition = MCP_TOOLS.get(quote.toolName);
  const title = definition?.title ?? quote.toolName;
  const detail = (quote.input && definition?.approvalDetail?.(quote.input)) || definition?.summary || "";
  const cost = quote.credits === null ? "Priced when it runs" : quote.credits === 0 ? "No credits" : `${quote.credits} credits`;
  const balance = await getBalance(userId);

  if (quote.outcome?.kind === "approved") {
    return (
      <AuthCard title={title} subtitle={detail}>
        <Notice tone="ok">Approved. It has started.</Notice>
        <Link href={quote.outcome.jobId ? `/videos/${encodeURIComponent(quote.outcome.jobId)}` : "/videos"} className={cn(buttonVariants(), "h-11 rounded-full bg-white text-black hover:bg-white/85")}>
          See the video
        </Link>
      </AuthCard>
    );
  }
  if (quote.outcome?.kind === "declined" || quote.used || quote.expired) {
    const why = quote.outcome?.kind === "declined" ? "Declined. Nothing was started or charged." : quote.used ? "This quote was already used." : "This quote expired. Ask the agent for a new price.";
    return (
      <AuthCard title={title} subtitle={detail}>
        <Notice tone="muted">{why}</Notice>
        <Link href="/videos" className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-full")}>
          Go to your videos
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={`Approve: ${title}`} subtitle={detail}>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10">
          <Coins className="size-4" aria-hidden />
        </span>
        <span className="leading-snug">
          <span className="font-medium text-foreground">{cost}</span>
          <span className="text-muted-foreground"> · {balance.total} credits left</span>
        </span>
      </div>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <p className="text-xs leading-relaxed text-muted-foreground">
        An agent asked for this. Nothing runs until you approve, and the quote works once.
      </p>
      <form action={decideQuote} className="flex gap-2">
        <input type="hidden" name="quoteId" value={quoteId} />
        <Button type="submit" name="decision" value="decline" variant="outline" className="h-11 flex-1 rounded-full">
          Decline
        </Button>
        <Button type="submit" name="decision" value="approve" className="h-11 flex-1 rounded-full bg-white text-black hover:bg-white/85">
          Approve
        </Button>
      </form>
    </AuthCard>
  );
}

export default function ApprovePage(props: Props) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-24 h-96 w-full max-w-sm rounded-3xl" />}>
      <Approval {...props} />
    </Suspense>
  );
}
