import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { videoJobCredits } from "@/lib/billing/estimate";
import type { CoachBrief } from "@/lib/coach/brief-blocks";
import { videoModeById } from "@/lib/video/modes";
import { presetById } from "@/lib/video/presets";

export type BriefApproval = "ready" | "sent";

const TIER_LABEL: Record<string, string> = { low: "Low", pro: "Pro", ultra: "Ultra" };

const settingsFor = (brief: CoachBrief) => [
  { label: "Mode", value: videoModeById(brief.mode)?.title ?? brief.mode },
  { label: "Format", value: brief.format },
  { label: "Length", value: `${brief.length}s` },
  { label: "Style", value: presetById(brief.preset)?.name ?? brief.preset },
  { label: "Tier", value: TIER_LABEL[brief.tier] ?? brief.tier },
];

const creditsFor = (brief: CoachBrief) => {
  const length = Number.parseInt(brief.length, 10);
  if (!Number.isFinite(length) || length <= 0) return 0;
  return videoJobCredits({ mode: brief.mode, tier: brief.tier, length });
};

export function CoachBriefCard({
  brief,
  approval,
  onApprove,
}: {
  brief: CoachBrief;
  approval?: BriefApproval;
  onApprove?: () => void;
}) {
  const credits = creditsFor(brief);

  return (
    <article className="mt-3 overflow-hidden rounded-2xl border border-border bg-muted/40 text-sm" aria-label="Proposed brief">
      <div className="p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Proposed brief</p>
        <dl className="mt-3 flex flex-wrap gap-2">
          {settingsFor(brief).map((setting) => (
            <div key={setting.label} className="rounded-xl border border-border bg-white px-3 py-1.5">
              <dt className="text-[11px] text-muted-foreground">{setting.label}</dt>
              <dd className="font-medium">{setting.value}</dd>
            </div>
          ))}
        </dl>
        {brief.hook && (
          <p className="mt-4 leading-relaxed">
            <span className="font-semibold">Hook. </span>
            {brief.hook}
          </p>
        )}
        {brief.beats.length > 0 && (
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed text-foreground/80 marker:text-muted-foreground">
            {brief.beats.map((beat) => (
              <li key={beat}>{beat}</li>
            ))}
          </ol>
        )}
        {brief.vo && <p className="mt-3 leading-relaxed text-foreground/80">{brief.vo}</p>}
        {brief.cta && (
          <p className="mt-3 leading-relaxed">
            <span className="font-semibold">CTA. </span>
            {brief.cta}
          </p>
        )}
      </div>
      {approval ? (
        <div className="flex flex-col gap-2 border-t border-border bg-white px-4 py-3">
          {approval === "sent" ? (
            <p className="flex items-center gap-2 text-sm font-medium" role="status">
              <Check className="size-4 text-primary" aria-hidden />
              Approved. Queuing it now.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  size="lg"
                  className="h-11 w-full rounded-xl sm:w-auto sm:px-6"
                  onClick={onApprove}
                >
                  Approve
                </Button>
                {credits > 0 ? (
                  <p className="text-xs text-muted-foreground">Uses about {credits.toLocaleString()} credits</p>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">Keep chatting to edit.</p>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
