import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusItem } from "@/lib/production/progress";

export function StatusTimeline({
  items,
  elapsed,
  currentLabel,
}: {
  items: StatusItem[];
  elapsed?: string | null;
  currentLabel?: string;
}) {
  const spinning = items.some((item) => item.state === "active");
  const liveLabel = currentLabel ?? items.find((item) => item.state === "active")?.label;

  return (
    <div className="flex items-start gap-3 rounded-xl bg-muted/50 px-4 py-3" aria-live="polite" aria-busy={spinning}>
      <ol className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label={liveLabel ?? "Production progress"}>
        {items.map((item) => (
          <li
            key={item.key}
            className={cn(
              "flex items-center gap-2 text-sm",
              item.state === "pending" && "text-muted-foreground",
              item.state === "active" && "font-medium text-foreground",
              item.state === "done" && "text-foreground",
              item.state === "failed" && "text-destructive",
            )}
          >
            <StatusIcon state={item.state} />
            <span>
              {item.label}
              {item.detail ? <span className="font-normal text-muted-foreground"> · {item.detail}</span> : null}
            </span>
          </li>
        ))}
      </ol>
      {elapsed && (
        <span className="shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground" aria-label={`Elapsed ${elapsed}`}>
          {elapsed}
        </span>
      )}
    </div>
  );
}

const StatusIcon = ({ state }: { state: StatusItem["state"] }) => {
  if (state === "done") return <Check className="size-4 text-primary" aria-hidden />;
  if (state === "active") return <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden />;
  if (state === "failed") return <TriangleAlert className="size-4 text-destructive" aria-hidden />;
  return <span className="size-4 rounded-full border border-border" aria-hidden />;
};
