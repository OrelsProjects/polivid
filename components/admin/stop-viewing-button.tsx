"use client";

import { useState } from "react";

/** Ends "view as" and reloads into the admin's own account. */
export function StopViewingButton() {
  const [stopping, setStopping] = useState(false);
  return (
    <button
      type="button"
      disabled={stopping}
      onClick={() => {
        setStopping(true);
        // A full load, so every cached query is read again as the admin's own account.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- client caches must reset
        void fetch("/api/admin/view-as", { method: "DELETE" }).finally(() => window.location.assign("/admin/view-as"));
      }}
      className="cursor-pointer rounded-lg bg-black px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-black/80 disabled:opacity-60"
    >
      {stopping ? "Stopping…" : "Stop viewing"}
    </button>
  );
}
