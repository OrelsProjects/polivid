"use client";

import { useState } from "react";
import { ShotPlanCard } from "@/components/generator";
import type { ShotPlan } from "@/lib/store/endpoints/videos";

const locked: ShotPlan = {
  credits: 1200,
  filmedSeconds: 50,
  cuts: [
    "wide stance on the dolly track, crash zoom from wide to medium",
    "whip-pan into tight close-up on temple and pointing finger",
    "fast 180 degree orbit at chest height, screen wall streaking behind",
    "crane down from steel beams to low floor angle, crouch with arms spread",
    "dutch-angle medium, chest tap with hood flying back",
    "widest shot, jump with arms up under the neon sign",
    "snap zoom from sneakers up to medium, sneakers hitting concrete",
    "top-down overhead spin over the concrete floor",
    "pure silhouette against the violet and cyan neon wall",
    "low-angle wide freeze pose lit by screen glow with a single neon flicker",
  ].map((camera) => ({ seconds: 1, camera, filmSec: 5 })),
};

const flexible: ShotPlan = {
  credits: 800,
  filmedSeconds: 10,
  cuts: [
    { seconds: 4, camera: "wide from the doorway", filmSec: 4 },
    { seconds: 3, camera: "close-up on hands", filmSec: 5 },
    { seconds: 3, camera: "overhead of the table", filmSec: 5 },
  ],
};

export default function ShotPlanPreviewPage() {
  const [plan, setPlan] = useState(flexible);
  const [lockedPlan, setLockedPlan] = useState(locked);
  const [submitted, setSubmitted] = useState(false);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-8">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
        }}
      >
        <ShotPlanCard
          plan={plan}
          length={10}
          maxSeconds={15}
          onChange={(cuts) =>
            setPlan({
              ...plan,
              cuts: cuts.map((cut) => ({ ...cut, filmSec: cut.seconds < 4 ? 5 : cut.seconds })),
            })
          }
        />
        <button type="submit" className="mt-3 rounded-lg bg-foreground px-3 py-2 text-sm text-background">
          Film it
        </button>
        <p>{submitted ? "Form submitted" : "Form idle"}</p>
      </form>
      <ShotPlanCard plan={lockedPlan} length={10} maxSeconds={15} onChange={(cuts) => setLockedPlan({ ...lockedPlan, cuts: cuts.map((cut, index) => ({ ...lockedPlan.cuts[index]!, camera: cut.camera, seconds: cut.seconds })) })} />
      <pre className="text-xs">{JSON.stringify({ flexible: plan.cuts, locked: lockedPlan.cuts.map((cut) => cut.camera) }, null, 2)}</pre>
    </main>
  );
}
