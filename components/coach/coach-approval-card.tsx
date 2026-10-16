import { Button } from "@/components/ui/button";

export function CoachApprovalCard({
  title,
  detail,
  automatic,
  onApprove,
  onDeny,
}: {
  title: string;
  detail: string;
  automatic?: boolean;
  onApprove?: () => void;
  onDeny?: () => void;
}) {
  return (
    <div className="mt-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      {automatic ? (
        <p className="mt-2 text-xs text-muted-foreground">Checking approval…</p>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" onClick={onApprove}>
            Approve
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDeny}>
            Deny
          </Button>
        </div>
      )}
    </div>
  );
}
