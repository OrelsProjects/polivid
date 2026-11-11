"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RetryJobButton({ id }: { id: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError("");
          void fetch(`/api/videos/${id}/retry`, { method: "POST" })
            .then(async (response) => {
              const payload = (await response.json().catch(() => null)) as { error?: string } | null;
              if (!response.ok) throw new Error(payload?.error || "Couldn't retry this video.");
              router.refresh();
            })
            .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Couldn't retry this video."))
            .finally(() => setBusy(false));
        }}
        className="inline-flex h-11 items-center rounded-full border border-primary px-4 font-medium text-primary disabled:opacity-50"
      >
        Retry
      </button>
      {error ? <p className="m-0 text-[12px] text-red-300">{error}</p> : null}
    </div>
  );
}
