import Link from "next/link";

export function CoachActionCard({
  label,
  state,
  href,
  linkLabel,
}: {
  label: string;
  state: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <p className="mt-2 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
      <span>
        {label}
        {state ? ` · ${state}` : ""}
      </span>
      {href && linkLabel ? (
        <>
          <span aria-hidden> · </span>
          <Link href={href} className="font-medium text-primary underline-offset-4 hover:underline">
            {linkLabel}
          </Link>
        </>
      ) : null}
    </p>
  );
}
