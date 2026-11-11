import type { Metadata } from "next";
import { CoachPage } from "@/components/coach/coach-page";
import { availableGenerationModelIds } from "@/lib/video/available-models";

export const metadata: Metadata = { title: "Coach" };

export default function CoachIndexPage() {
  return <CoachPage models={availableGenerationModelIds()} />;
}
