"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useOpenBillingPortalMutation } from "@/lib/store/endpoints/billing";

export function ManageBillingButton() {
  const [openPortal, { isLoading, isSuccess }] = useOpenBillingPortalMutation();
  const [error, setError] = useState<string | null>(null);
  const busy = isLoading || isSuccess;

  const handleClick = async () => {
    setError(null);
    try {
      window.location.assign(await openPortal().unwrap());
    } catch (cause) {
      setError(apiErrorMessage(cause, "Couldn't open billing."));
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" disabled={busy} onClick={() => void handleClick()} className="h-10 rounded-xl">
        {busy ? "Opening…" : "Manage subscription"}
      </Button>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
