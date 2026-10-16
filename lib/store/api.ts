import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

/**
 * Single RTK Query slice for every `/api/*` call made from client components.
 * Feature endpoints are added with `api.injectEndpoints` in `lib/store/endpoints/`.
 */
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api", cache: "no-store" }),
  tagTypes: ["Character", "Preset", "Credits", "Video", "ActiveJobs", "Production", "CoachThread", "Upload"],
  endpoints: () => ({}),
});
