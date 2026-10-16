import { api } from "../api";

export const billingApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** Total credits left: plan credits plus bonus packs. */
    getCredits: build.query<number, void>({
      query: () => "billing/credits",
      transformResponse: (body: { total: number }) => body.total,
      providesTags: ["Credits"],
    }),
    getProductionEstimate: build.query<number, string>({
      query: (productionId) => ({
        url: "billing/estimate",
        method: "POST",
        body: { kind: "production", productionId },
      }),
      transformResponse: (body: { credits: number }) => body.credits,
      providesTags: (_result, _error, productionId) => [{ type: "Production", id: productionId }],
    }),
    /** Resolves to the Stripe billing portal URL. */
    openBillingPortal: build.mutation<string, void>({
      query: () => ({ url: "billing/portal", method: "POST" }),
      transformResponse: (body: { url: string }) => body.url,
    }),
  }),
});

export const { useGetCreditsQuery, useGetProductionEstimateQuery, useOpenBillingPortalMutation } = billingApi;
