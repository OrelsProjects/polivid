import type { Metadata } from "next";
import { CoachPage } from "@/components/coach/coach-page";

export const metadata: Metadata = { title: "Coach" };

export default function CoachIndexPage() {
  return <CoachPage />;
}
