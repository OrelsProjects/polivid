import type { CoachThreadItem } from "@/components/coach/coach-thread-list";
import { api } from "../api";

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
  }),
});

export const { useGetCoachThreadsQuery, useCreateCoachThreadMutation } = coachApi;
