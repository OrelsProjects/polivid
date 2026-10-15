import type { VideoFormat } from "@/lib/video/schema";
import type { Timeline } from "./schema";

export interface EditProjectView {
  id: string;
  title: string;
  format: VideoFormat;
  timeline: Timeline;
  version: number;
  sourceVideoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EditProjectSummary {
  id: string;
  title: string;
  format: VideoFormat;
  sourceVideoId: string | null;
  updatedAt: string;
}

export interface LibraryVideo {
  id: string;
  title: string;
  format: VideoFormat;
  length: number;
  hasFootage: boolean;
}
