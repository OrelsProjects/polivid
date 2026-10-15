import { videoJobCredits } from "@/lib/billing/estimate";
import { TRIAL_CREDITS } from "@/lib/billing/plans";

const EXAMPLES = [
  { label: "5s Wan 480p draft", credits: videoJobCredits({ modelId: "wan", resolution: "480p", length: 5 }) },
  { label: "30s Wan 720p video", credits: videoJobCredits({ modelId: "wan", resolution: "720p", length: 30 }) },
  { label: "15s MiniMax H3 at 2K", credits: videoJobCredits({ modelId: "hailuo", resolution: "2K", length: 15 }) },
  { label: "Motion graphics, Pro", credits: videoJobCredits({ mode: "motion-graphics", tier: "pro", length: 30 }) },
] as const;

export function CreditExamples() {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
      <h3 className="font-semibold">What credits buy</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        1 credit is $0.01 of provider cost. {TRIAL_CREDITS} free credits is enough to try a short draft.
      </p>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {EXAMPLES.map((example) => (
          <div key={example.label} className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2 text-sm">
            <dt className="text-muted-foreground">{example.label}</dt>
            <dd className="font-medium tabular-nums">{example.credits.toLocaleString()} credits</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
