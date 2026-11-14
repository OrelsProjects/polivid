"use client";

import { Check, Copy, KeyRound, Plug, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createKeyAction, disconnectAppAction, revokeKeyAction } from "./actions";

export interface KeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface AppRow {
  clientId: string;
  name: string;
  connectedAt: string;
  lastUsedAt: string | null;
}

const day = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso)) : "Never";

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-full"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function Snippet({ title, code }: { title: string; code: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{title}</span>
        <CopyButton value={code} />
      </div>
      <pre className="overflow-x-auto rounded-xl bg-black/40 p-3 text-xs leading-relaxed text-white/80">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function ApiKeysPanel({ keys, mcpUrl }: { keys: KeyRow[]; mcpUrl: string }) {
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const claudeCode = `claude mcp add --transport http polivid ${mcpUrl} \\\n  --header "Authorization: Bearer ${created ?? "<your key>"}"`;
  const json = JSON.stringify(
    { mcpServers: { polivid: { type: "http", url: mcpUrl, headers: { Authorization: `Bearer ${created ?? "<your key>"}` } } } },
    null,
    2,
  );

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <KeyRound className="size-5" aria-hidden />
        <h2 className="text-lg font-semibold">API keys</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        For Claude Code, Cursor, scripts, and any client where you paste a header. A key acts as you, so keep it secret.
      </p>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          start(async () => {
            const result = await createKeyAction(name);
            if ("error" in result && result.error) setError(result.error);
            else if ("key" in result && result.key) {
              setCreated(result.key);
              setName("");
            }
          });
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name it, e.g. Claude Code on my laptop"
          maxLength={60}
          aria-label="Key name"
          className="h-11 flex-1 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <Button type="submit" disabled={pending} className="h-11 rounded-full bg-white px-5 text-black hover:bg-white/85">
          {pending ? "Creating…" : "Create key"}
        </Button>
      </form>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      {created ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
          <p className="text-sm font-medium">Copy your key now. It won&apos;t be shown again.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 overflow-x-auto rounded-xl bg-black/40 px-3 py-2 text-xs">{created}</code>
            <CopyButton value={created} label="Copy key" />
          </div>
        </div>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        <Snippet title="Claude Code" code={claudeCode} />
        <Snippet title="Claude Desktop, Cursor and other JSON configs" code={json} />
      </div>
      {keys.length > 0 ? (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
          {keys.map((key) => (
            <li key={key.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{key.name}</span>
                <span className="text-xs text-muted-foreground">
                  {key.prefix}… · created {day(key.createdAt)} · last used {day(key.lastUsedAt)}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={pending}
                onClick={() => start(() => revokeKeyAction(key.id))}
              >
                <Trash2 aria-hidden />
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No keys yet.</p>
      )}
    </section>
  );
}

export function ConnectedAppsPanel({ apps, mcpUrl }: { apps: AppRow[]; mcpUrl: string }) {
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Plug className="size-5" aria-hidden />
        <h2 className="text-lg font-semibold">Connectors</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        For claude.ai, ChatGPT and other apps that add a connector by URL. Paste this address, then approve the sign-in
        window. No key needed.
      </p>
      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:items-center">
        <code className="flex-1 overflow-x-auto text-sm">{mcpUrl}</code>
        <CopyButton value={mcpUrl} label="Copy URL" />
      </div>
      {apps.length > 0 ? (
        <ul className="divide-y divide-white/10 rounded-2xl border border-white/10">
          {apps.map((app) => (
            <li key={app.clientId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{app.name}</span>
                <span className="text-xs text-muted-foreground">
                  connected {day(app.connectedAt)} · last used {day(app.lastUsedAt)}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={pending}
                onClick={() => start(() => disconnectAppAction(app.clientId))}
              >
                Disconnect
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No connected apps yet.</p>
      )}
    </section>
  );
}
