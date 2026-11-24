"use client";

import { Eye, LoaderCircle, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  plan: string;
  joined: string;
  videos: number;
  characters: number;
  you: boolean;
}

const joined = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

/** Admins pick someone to see, and use, the app as. */
export function ViewAsPicker() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/admin/users?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error("Couldn't load users.");
          const body = (await response.json()) as { users: AdminUser[] };
          setUsers(body.users);
          setError(null);
        })
        .catch((cause: unknown) => {
          if ((cause as Error).name !== "AbortError") setError("Couldn't load users.");
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const viewAs = async (user: AdminUser) => {
    setStarting(user.id);
    setError(null);
    const response = await fetch("/api/admin/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id }),
    }).catch(() => null);
    if (!response?.ok) {
      setStarting(null);
      setError("Couldn't switch to that user.");
      return;
    }
    // A full load, so every cached query and draft is read again as the new account.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- client caches must reset
    window.location.assign("/dashboard");
  };

  return (
    <div className="flex flex-col gap-4">
      <label className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email"
          aria-label="Search users"
          className="h-11 w-full rounded-xl border border-input bg-background pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {users === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden /> Loading users…
        </p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one matches that.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card">
          {users.map((user) => (
            <li key={user.id} className="flex items-center gap-3 px-4 py-3">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- remote avatar, tiny
                <img src={user.image} alt="" className="size-9 rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
                  <UserRound className="size-4" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {user.name || user.email}
                  {user.you ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.name ? `${user.email} · ` : ""}
                  {user.plan} · {user.videos} videos · {user.characters} characters · joined {joined(user.joined)}
                </p>
              </div>
              {user.you ? null : (
                <Button type="button" variant="outline" size="sm" disabled={starting !== null} onClick={() => void viewAs(user)}>
                  {starting === user.id ? <LoaderCircle className="animate-spin" aria-hidden data-icon="inline-start" /> : <Eye aria-hidden data-icon="inline-start" />}
                  View as
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
