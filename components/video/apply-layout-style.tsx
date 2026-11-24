"use client";

import { LayoutTemplate } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MediaUpload } from "@/components/media-upload";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LAYOUT_STYLES, type LayoutMediaRole, type LayoutStyleId } from "@/lib/video/layout/styles";

/** Styles that can run today. The rest are listed so people can see what is coming. */
const READY: ReadonlySet<LayoutStyleId> = new Set(["split-presenter"]);

const ROLE_LABEL: Record<LayoutMediaRole, string> = {
  picture: "Picture",
  post: "Post",
  screenshot: "Screenshot",
  recording: "Screen recording",
};

/**
 * Re-edits a finished avatar or UGC video in a layout style. The take is reused, so only the
 * pictures it draws cost credits. Uploads are shown first and lower the price.
 */
export function ApplyLayoutStyle({ videoId }: { videoId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<LayoutStyleId>("split-presenter");
  const [keys, setKeys] = useState<string[]>([]);
  const [roles, setRoles] = useState<Record<string, LayoutMediaRole>>({});
  const [credits, setCredits] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const media = keys.map((key) => ({ key, role: roles[key] ?? "picture" }));
  const body = JSON.stringify({ style, media });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch(`/api/videos/${videoId}/layout`, { method: "PUT", headers: { "Content-Type": "application/json" }, body })
      .then(async (response) => {
        const reply = (await response.json().catch(() => null)) as { credits?: number; error?: string } | null;
        if (cancelled) return;
        setCredits(response.ok && typeof reply?.credits === "number" ? reply.credits : null);
        setError(response.ok ? null : (reply?.error ?? "Couldn't price that layout."));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, videoId, body]);

  const apply = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/videos/${videoId}/layout`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const reply = (await response.json().catch(() => null)) as { jobId?: string; error?: string } | null;
      if (!response.ok || !reply?.jobId) throw new Error(reply?.error ?? "Couldn't start the layout.");
      router.push(`/videos/${reply.jobId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't start the layout.");
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <LayoutTemplate data-icon="inline-start" />
        Layout styles
      </Button>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold">Layout style</h2>
        <p className="mt-1 text-xs text-muted-foreground">Re-edits this video the way Shorts creators cut. Your take is reused, so nothing is filmed again.</p>
      </div>
      <div role="radiogroup" aria-label="Layout style" className="flex flex-col gap-2">
        {LAYOUT_STYLES.filter((item) => item.avatar).map((item) => {
          const ready = READY.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={style === item.id}
              disabled={!ready || busy}
              onClick={() => setStyle(item.id)}
              className={cn(
                "cursor-pointer rounded-xl border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50",
                style === item.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/30",
              )}
            >
              <span className="text-sm font-medium">{item.title}</span>
              {!ready ? <span className="ml-2 text-xs text-muted-foreground">Soon</span> : null}
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.description}</span>
            </button>
          );
        })}
      </div>
      <MediaUpload
        kind="image"
        multiple
        max={12}
        mediaKeys={keys}
        onChangeKeys={setKeys}
        disabled={busy}
        label="Your pictures, posts, or screenshots (optional)"
        hint="Shown before anything is drawn. Each one you add makes it cheaper."
      />
      {keys.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {keys.map((key, index) => (
            <li key={key} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Upload {index + 1}</span>
              <select
                value={roles[key] ?? "picture"}
                disabled={busy}
                onChange={(event) => setRoles((current) => ({ ...current, [key]: event.target.value as LayoutMediaRole }))}
                className="h-8 rounded-lg border border-border bg-background px-2"
                aria-label={`What upload ${index + 1} is`}
              >
                {(["picture", "post", "screenshot"] as const).map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={() => void apply()} disabled={busy || credits === null}>
          {busy ? "Starting…" : credits === null ? "Apply" : `Apply · ${credits} credits`}
        </Button>
      </div>
    </section>
  );
}
