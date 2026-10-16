import type { CustomPresetTile } from "@/components/preset-picker";
import { api } from "../api";

export const presetsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPresets: build.query<CustomPresetTile[], void>({
      query: () => "presets",
      transformResponse: (body: { presets?: CustomPresetTile[] }) => body.presets ?? [],
      providesTags: ["Preset"],
    }),
    createPreset: build.mutation<CustomPresetTile, { name: string; promptFragment: string }>({
      query: (preset) => ({ url: "presets", method: "POST", body: preset }),
      transformResponse: (body: { preset: CustomPresetTile }) => body.preset,
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data: preset } = await queryFulfilled.catch(() => ({ data: null }));
        if (!preset) return;
        dispatch(presetsApi.util.updateQueryData("getPresets", undefined, (presets) => [preset, ...presets]));
      },
    }),
    polishPreset: build.mutation<string, string>({
      query: (description) => ({ url: "presets/polish", method: "POST", body: { description } }),
      transformResponse: (body: { fragment: string }) => body.fragment,
    }),
  }),
});

export const { useGetPresetsQuery, useCreatePresetMutation, usePolishPresetMutation } = presetsApi;
