import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeView, type HomeContinue, type HomeNeed } from "@/components/studio/home-view";
import { listStudioProjects, type StudioProjectItem } from "@/lib/studio/library";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Home" };

export default function StudioHomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <Home />
    </Suspense>
  );
}

const needFrom = (item: StudioProjectItem): HomeNeed => ({
  tone: item.k === "ready" ? "ready" : item.k === "rendering" ? "rendering" : "failed",
  chip: item.k === "ready" ? "Ready" : item.k === "rendering" ? "Rendering" : "Needs attention",
  title: item.title,
  meta: item.meta,
  action: item.k === "ready" ? "Open & download" : item.k === "rendering" ? "Open" : "Review",
  href: item.href,
  primary: item.k === "ready",
});

const continueFrom = (item: StudioProjectItem): HomeContinue => ({
  title: item.title,
  status: item.k === "ready" ? "Ready" : item.k === "rendering" ? "Rendering" : "Needs attention",
  tone: item.k === "ready" ? "ready" : item.k === "rendering" ? "rendering" : "failed",
  preview: item.thumbs[0]?.label || "preview",
  href: item.href,
});

async function Home() {
  const user = await getCurrentUser();
  const name = user.name ?? user.email ?? "there";
  const first = name.includes("@") ? name.split("@")[0] : name.trim().split(/\s+/)[0] || "there";
  const hour = new Date().getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const projects = await listStudioProjects();
  const needs = projects.filter((item) => item.k === "failed" || item.k === "rendering").slice(0, 3).map(needFrom);
  const ready = projects.filter((item) => item.k === "ready").slice(0, 1).map(needFrom);
  return (
    <HomeView
      greeting={`Good ${part}, ${first}.`}
      needs={[...needs, ...ready].slice(0, 3)}
      continueItems={projects.slice(0, 4).map(continueFrom)}
    />
  );
}
