import type { VideoFormat } from "@/lib/video/schema";
import type { Timeline } from "./schema";

export interface EditProjectView {
  id: string;
  title: string;
  format: VideoFormat;
  timeline: Timeline;
  version: number;
  sourceVideoId: string | null;
  /** Finished MP4 for this timeline version, when one exists. */
  exportVideoId: string | null;
  /** Project version that exportVideoId was rendered from. */
  exportVersion: number | null;
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
