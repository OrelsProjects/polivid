import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { listApiKeys, listConnectedApps } from "@/lib/mcp/auth/store";
import { mcpResourceUrl } from "@/lib/mcp/origin";
import { getCurrentUser } from "@/lib/session";
import { ApiKeysPanel, ConnectedAppsPanel } from "./connect-panels";

export const metadata: Metadata = { title: "Connect agents" };

async function Panels() {
  await connection();
  const user = await getCurrentUser();
  const [keys, apps] = await Promise.all([listApiKeys(user.id), listConnectedApps(user.id)]);
  const mcpUrl = mcpResourceUrl();
  return (
    <>
      <ConnectedAppsPanel
        mcpUrl={mcpUrl}
        apps={apps.map((app) => ({
          ...app,
          connectedAt: app.connectedAt.toISOString(),
          lastUsedAt: app.lastUsedAt?.toISOString() ?? null,
        }))}
      />
      <ApiKeysPanel
        mcpUrl={mcpUrl}
        keys={keys.map((key) => ({
          ...key,
          createdAt: key.createdAt.toISOString(),
          lastUsedAt: key.lastUsedAt?.toISOString() ?? null,
        }))}
      />
    </>
  );
}

export default function ConnectPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10 px-4 py-8 sm:px-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Connect agents</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Let Claude, ChatGPT, Cursor or your own agent drive PoliVid: every mode, model, edit and production. Anything that
          spends credits shows the price first and runs only after you agree.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Panels />
      </Suspense>
    </div>
  );
}
