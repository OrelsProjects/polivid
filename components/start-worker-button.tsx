"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function StartWorkerButton({ hint }: { hint?: string }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/videos/worker", { method: "POST" });
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (response.status === 401) {
        router.push(`/login?callbackUrl=${encodeURIComponent("/create")}`);
        return;
      }
      if (!response.ok) throw new Error(body?.error ?? "Couldn't start the worker.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't start the worker.");
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        disabled={starting}
        aria-label="Start the worker"
        aria-busy={starting}
        onClick={() => {
          void handleStart();
        }}
      >
        {starting ? "Starting…" : "Start worker"}
      </Button>
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
