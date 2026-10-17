import type { Timeline } from "@/lib/editor/schema";
import type { EditProjectView } from "@/lib/editor/types";
import { api } from "../api";

export type SaveEditProjectBody = { id: string; title: string; version: number; timeline: Timeline };

export const editorApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Creates an edit project, from a finished video when `videoId` is set, and resolves to its id. */
    createEditProject: build.mutation<string, string | undefined>({
      query: (videoId) => ({ url: "editor/projects", method: "POST", body: videoId ? { videoId } : {} }),
      transformResponse: (body: { id: string }) => body.id,
    }),
    saveEditProject: build.mutation<EditProjectView, SaveEditProjectBody>({
      query: ({ id, ...body }) => ({ url: `editor/projects/${id}`, method: "PUT", body }),
    }),
    revertEditProject: build.mutation<EditProjectView, string>({
      query: (id) => ({ url: `editor/projects/${id}/revert`, method: "POST" }),
    }),
    /** Starts an MP4 render. Resolves to the new job, or the one already running for this edit. */
    exportEditProject: build.mutation<{ jobId: string; resumed: boolean }, string>({
      query: (id) => ({ url: `editor/projects/${id}/export`, method: "POST" }),
      transformResponse: (body: { jobId: string; resumed?: boolean }) => ({
        jobId: body.jobId,
        resumed: body.resumed === true,
      }),
      invalidatesTags: ["ActiveJobs", "Credits"],
    }),
    /** Remembers a finished render so the next Export click can download it. */
    rememberEditExport: build.mutation<
      { videoId: string; version: number },
      { id: string; videoId: string; version: number }
    >({
      query: ({ id, ...body }) => ({ url: `editor/projects/${id}/export`, method: "POST", body }),
    }),
  }),
});

export const {
  useCreateEditProjectMutation,
  useSaveEditProjectMutation,
  useRevertEditProjectMutation,
  useExportEditProjectMutation,
  useRememberEditExportMutation,
} = editorApi;
