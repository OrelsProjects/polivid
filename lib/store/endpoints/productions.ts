import type { ProductionView } from "@/lib/production/types";
import { api } from "../api";

type ProductionTag = { type: "Production"; id: string };

const productionTag = (id: string): ProductionTag => ({ type: "Production", id });

export const productionsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProduction: build.query<ProductionView, string>({
      query: (id) => `productions/${id}`,
      transformResponse: (body: { production: ProductionView }) => body.production,
      providesTags: (_result, _error, id) => [productionTag(id)],
      keepUnusedDataFor: 0,
    }),
    submitProductionAnswers: build.mutation<void, { id: string; answers: Record<string, string> }>({
      query: ({ id, answers }) => ({ url: `productions/${id}/answers`, method: "POST", body: { answers } }),
      onQueryStarted({ id }, { dispatch }) {
        dispatch(
          productionsApi.util.updateQueryData("getProduction", id, (production) => {
            production.status = "drafting";
            production.stage = "develop";
            production.runStartedAt = new Date().toISOString();
          }),
        );
      },
      invalidatesTags: (_result, _error, { id }) => [productionTag(id)],
    }),
    approveProduction: build.mutation<void, string>({
      query: (id) => ({ url: `productions/${id}/approve`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [productionTag(id), "Credits"],
    }),
    /** Resolves to the new production id when regenerating forks a copy. */
    regenerateProduction: build.mutation<string | undefined, string>({
      query: (id) => ({ url: `productions/${id}/regenerate`, method: "POST" }),
      transformResponse: (body: { id?: string } | null) => body?.id,
      invalidatesTags: (_result, _error, id) => [productionTag(id), "Credits"],
    }),
    cancelProduction: build.mutation<void, string>({
      query: (id) => ({ url: `productions/${id}/cancel`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [productionTag(id)],
    }),
    /** Resolves to the edit project id for this production. */
    openProductionEditor: build.mutation<string, string>({
      query: (id) => ({ url: `productions/${id}/editor`, method: "POST" }),
      transformResponse: (body: { project: { id: string } }) => body.project.id,
      invalidatesTags: (_result, _error, id) => [productionTag(id)],
    }),
    /** Retries one step, or the whole production when `stepId` is missing. */
    retryProduction: build.mutation<void, { id: string; stepId?: string }>({
      query: ({ id, stepId }) => ({ url: `productions/${id}/retry`, method: "POST", body: stepId ? { stepId } : {} }),
      onQueryStarted({ id, stepId }, { dispatch }) {
        if (stepId) return;
        dispatch(
          productionsApi.util.updateQueryData("getProduction", id, (production) => {
            production.status = production.steps.some((step) => step.status === "failed" || step.status === "canceled")
              ? "generating"
              : "drafting";
            production.error = null;
          }),
        );
      },
      invalidatesTags: (_result, _error, { id }) => [productionTag(id)],
    }),
    updateProductionEntity: build.mutation<void, { id: string; kind: string; stableKey: string; data: unknown }>({
      query: ({ id, ...entity }) => ({ url: `productions/${id}`, method: "PATCH", body: entity }),
      invalidatesTags: (_result, _error, { id }) => [productionTag(id)],
    }),
  }),
});

export const {
  useGetProductionQuery,
  useSubmitProductionAnswersMutation,
  useApproveProductionMutation,
  useRegenerateProductionMutation,
  useCancelProductionMutation,
  useOpenProductionEditorMutation,
  useRetryProductionMutation,
  useUpdateProductionEntityMutation,
} = productionsApi;
