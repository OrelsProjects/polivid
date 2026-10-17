import { CircleAlert, Coins, LoaderCircle } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";

export function CoachApprovalCard({
  title,
  detail,
  spendsCredits = false,
  destructive = false,
  automatic,
  onApprove,
  onDeny,
}: {
  title: string;
  detail: string;
  spendsCredits?: boolean;
  destructive?: boolean;
  automatic?: boolean;
  onApprove?: () => void;
  onDeny?: () => void;
}) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="mt-3 rounded-2xl border border-border bg-card p-4"
    >
      <p id={titleId} className="text-sm font-semibold">
        {title}
      </p>
      {detail ? <p className="mt-1 text-sm text-foreground/80 [overflow-wrap:anywhere]">{detail}</p> : null}
      {spendsCredits || destructive ? (
        <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
          {spendsCredits ? (
            <li className="flex items-center gap-1.5">
              <Coins aria-hidden className="size-3.5 text-primary" />
              Uses credits when you approve
            </li>
          ) : null}
          {destructive ? (
            <li className="flex items-center gap-1.5">
              <CircleAlert aria-hidden className="size-3.5 text-destructive" />
              Can&apos;t be undone
            </li>
          ) : null}
        </ul>
      ) : null}
      {automatic ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <LoaderCircle aria-hidden className="size-3.5 motion-safe:animate-spin" />
          Checking approval…
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            className="h-10 rounded-xl px-4"
            onClick={onApprove}
          >
            Approve
          </Button>
          <Button type="button" variant="outline" className="h-10 rounded-xl px-4" onClick={onDeny}>
            Not now
          </Button>
        </div>
      )}
    </section>
  );
}
