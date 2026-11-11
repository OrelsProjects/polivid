import type { CoachThreadItem } from "@/components/coach/coach-thread-list";
import type { SavedPicture } from "@/lib/coach/picture-output";
import type { EditProjectView } from "@/lib/editor/types";
import { api } from "../api";

export type RetryCoachPictureInput = {
  threadId: string;
  messageId: string;
  toolCallId: string;
};

export type RetryStoryboardFrameInput = RetryCoachPictureInput & { frameIndex: number };

export const coachApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCoachThreads: build.query<CoachThreadItem[], void>({
      query: () => "coach/threads",
      transformResponse: (body: { threads?: CoachThreadItem[] }) => body.threads ?? [],
      providesTags: ["CoachThread"],
    }),
    createCoachThread: build.mutation<CoachThreadItem, void>({
      query: () => ({ url: "coach/threads", method: "POST" }),
      transformResponse: (body: { id: string; title?: string }) => ({
        id: body.id,
        title: body.title ?? "New chat",
        updatedAt: new Date().toISOString(),
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data: thread } = await queryFulfilled.catch(() => ({ data: null }));
        if (!thread) return;
        dispatch(coachApi.util.updateQueryData("getCoachThreads", undefined, (threads) => [thread, ...threads]));
      },
    }),
    ensureCoachProject: build.mutation<EditProjectView, string>({
      query: (threadId) => ({ url: `coach/threads/${threadId}/project`, method: "POST" }),
    }),
    /** Runs the same picture edit or generation again. Spends one credit. */
    retryCoachPicture: build.mutation<SavedPicture, RetryCoachPictureInput>({
      query: ({ threadId, messageId, toolCallId }) => ({
        url: `coach/threads/${threadId}/pictures`,
        method: "POST",
        body: { messageId, toolCallId },
      }),
      invalidatesTags: ["Upload", "Credits"],
    }),
    /** Makes one storyboard frame again. Spends one credit. */
    retryStoryboardFrame: build.mutation<{ frame: { index: number; imageKey: string; url: string } }, RetryStoryboardFrameInput>({
      query: ({ threadId, messageId, toolCallId, frameIndex }) => ({
        url: `coach/threads/${threadId}/pictures`,
        method: "POST",
        body: { messageId, toolCallId, frameIndex },
      }),
      invalidatesTags: ["Upload", "Credits"],
    }),
  }),
});

export const { useGetCoachThreadsQuery, useCreateCoachThreadMutation, useEnsureCoachProjectMutation, useRetryCoachPictureMutation,
  useRetryStoryboardFrameMutation,
} =
  coachApi;
