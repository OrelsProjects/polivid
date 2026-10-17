"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HoverCard } from "@/components/motion/motion";
import { Button } from "@/components/ui/button";
import { formatUsdFromCents, TOPUP_PACKS } from "@/lib/billing/plans";

export function TopupPacks({ signedIn = false }: { signedIn?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (pack: string) => {
    setBusy(pack);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "topup", pack }),
      });
      const body = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/billing")}`);
        return;
      }
      if (!response.ok || !body?.url) {
        throw new Error(body?.error ?? "Couldn't start checkout.");
      }
      window.location.assign(body.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't start checkout.");
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-lg font-semibold">Credit boosts</h3>
        <p className="text-sm text-muted-foreground">One-time packs that never expire. Used after your plan credits.</p>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {TOPUP_PACKS.map((pack) => (
          <HoverCard key={pack.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="font-semibold">{pack.name}</p>
            <p className="text-2xl font-semibold tracking-tight tabular-nums">{formatUsdFromCents(pack.cents)}</p>
            {signedIn ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy !== null}
                onClick={() => void handleCheckout(pack.id)}
                className="h-10 rounded-xl"
              >
                {busy === pack.id ? "Redirecting…" : "Buy credits"}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">Sign in from Billing to buy a pack.</p>
            )}
          </HoverCard>
        ))}
      </div>
    </div>
  );
}
