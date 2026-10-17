import type { z } from "zod";
import type { CreateVideoSchema } from "@/lib/video/create-schema";
import type { VideoJobView } from "@/lib/video/job-status";
import { api } from "../api";

export type CreateVideoBody = z.input<typeof CreateVideoSchema>;

export type SongTakeBody = { prompt: string; length: number; tier: string; characterId: string; hasSinger: boolean };
export type SongTake = {
  id: string;
  url: string;
  seconds: number;
  voiceName: string | null;
  credits: number;
  createdAt: string;
};

export type ShotPlanBody = {
  prompt: string;
  direction?: string;
  scene?: string;
  length: number;
  tier: string;
  referenceCount?: number;
  songReady?: boolean;
  mode?: "prompt" | "lyrics";
  format?: "9:16" | "1:1" | "16:9";
  visualDirection?: string;
  presetId?: string;
};
export type ShotPlan = {
  cuts: { seconds: number; camera: string; filmSec: number; images?: number[] }[];
  filmedSeconds: number;
  credits: number;
  brief?: {
    subject: string;
    setting: string;
    director: string;
    style: string;
    mustKeep: string;
    mustAvoid: string;
  };
  attachmentRoles?: { index: number; role: "subject" | "person" | "product" | "location" | "framing" }[];
};

export const videosApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Queues a video and resolves to its job id. */
    createVideo: build.mutation<string, CreateVideoBody>({
      query: (body) => ({ url: "videos", method: "POST", body }),
      transformResponse: (body: { jobId: string }) => body.jobId,
      invalidatesTags: ["ActiveJobs", "Credits"],
    }),
    /** Resolves to a rewritten prompt. */
    improvePrompt: build.mutation<string, string>({
      query: (description) => ({ url: "improve", method: "POST", body: { description } }),
      transformResponse: (body: { script: string }) => body.script,
    }),
    /** Plans lyrics-video cuts and their price. Nothing is filmed yet. */
    planVideoShots: build.mutation<ShotPlan, ShotPlanBody>({
      query: (body) => ({ url: "videos/shot-plan", method: "POST", body }),
    }),
    getVideoJob: build.query<VideoJobView, string>({
      query: (id) => `videos/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Video", id }],
      keepUnusedDataFor: 0,
    }),
    getActiveJobs: build.query<VideoJobView[], void>({
      query: () => ({ url: "videos", params: { status: "active" } }),
      transformResponse: (body: { jobs?: VideoJobView[] }) => body.jobs ?? [],
      providesTags: ["ActiveJobs"],
    }),
    retryVideo: build.mutation<void, string>({
      query: (id) => ({ url: `videos/${id}/retry`, method: "POST" }),
      invalidatesTags: ["ActiveJobs", "Credits"],
    }),
    pauseVideo: build.mutation<void, string>({
      query: (id) => ({ url: `videos/${id}/pause`, method: "POST" }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const paused = await queryFulfilled.then(() => true).catch(() => false);
        if (!paused) return;
        const markStopping = (job: VideoJobView) => {
          if (job.id === id) job.stopping = true;
        };
        dispatch(videosApi.util.updateQueryData("getVideoJob", id, markStopping));
        dispatch(
          videosApi.util.updateQueryData("getActiveJobs", undefined, (jobs) => {
            for (const job of jobs) markStopping(job);
          }),
        );
      },
    }),
    resumeVideo: build.mutation<void, string>({
      query: (id) => ({ url: `videos/${id}/resume`, method: "POST" }),
      invalidatesTags: ["ActiveJobs"],
    }),
    cancelVideo: build.mutation<void, string>({
      query: (id) => ({ url: `videos/${id}/cancel`, method: "POST" }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const canceled = await queryFulfilled.then(() => true).catch(() => false);
        if (!canceled) return;
        dispatch(
          videosApi.util.updateQueryData("getVideoJob", id, (job) => {
            job.status = "canceled";
          }),
        );
        dispatch(
          videosApi.util.updateQueryData("getActiveJobs", undefined, (jobs) => jobs.filter((job) => job.id !== id)),
        );
      },
      invalidatesTags: (_result, error) => (error ? [] : ["Credits"]),
    }),
  }),
});

export const {
  useCreateVideoMutation,
  useImprovePromptMutation,
  usePlanVideoShotsMutation,
  useGetVideoJobQuery,
  useGetActiveJobsQuery,
  useRetryVideoMutation,
  usePauseVideoMutation,
  useResumeVideoMutation,
  useCancelVideoMutation,
} = videosApi;
