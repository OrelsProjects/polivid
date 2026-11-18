import type { CharacterSummary } from "@/lib/characters/types";
import { api } from "../api";

export type VoicePreview = { generatedVoiceId: string; audioBase64: string };

export type SongTestInput = { characterId: string; style: string; lyrics: string; length: number };
export type SongTestResult = { original: string; vocal: string; sung: string; mix: string };

/** Every library call answers with the whole character, so the cached list is patched in place. */
const patchCharacter =
  () =>
  async (_: unknown, { dispatch, queryFulfilled }: { dispatch: (action: unknown) => unknown; queryFulfilled: Promise<{ data: CharacterSummary }> }) => {
    const { data: saved } = await queryFulfilled.catch(() => ({ data: null }));
    if (!saved) return;
    dispatch(
      charactersApi.util.updateQueryData("getCharacters", undefined, (characters) => {
        const index = characters.findIndex((item) => item.id === saved.id);
        if (index >= 0) characters[index] = saved;
      }),
    );
  };

const characterOf = (body: { character: CharacterSummary }) => body.character;

export type CharacterMediaAdd = { key: string; label?: string; lookId?: string | null; caption?: string; durationSec?: number; sourceMediaId?: string };

export const charactersApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCharacters: build.query<CharacterSummary[], void>({
      query: () => "characters",
      transformResponse: (body: { characters?: CharacterSummary[] }) => body.characters ?? [],
      providesTags: ["Character"],
    }),
    saveCharacter: build.mutation<CharacterSummary, { id?: string; form: FormData }>({
      query: ({ id, form }) => ({
        url: id ? `characters/${id}` : "characters",
        method: id ? "PATCH" : "POST",
        body: form,
      }),
      transformResponse: (body: { character: CharacterSummary }) => body.character,
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data: saved } = await queryFulfilled.catch(() => ({ data: null }));
        if (!saved) return;
        dispatch(
          charactersApi.util.updateQueryData("getCharacters", undefined, (characters) => {
            const index = characters.findIndex((item) => item.id === saved.id);
            if (index < 0) characters.unshift(saved);
            else characters[index] = saved;
          }),
        );
      },
    }),
    deleteCharacter: build.mutation<void, string>({
      query: (id) => ({ url: `characters/${id}`, method: "DELETE" }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const deleted = await queryFulfilled.then(() => true).catch(() => false);
        if (!deleted) return;
        dispatch(
          charactersApi.util.updateQueryData("getCharacters", undefined, (characters) =>
            characters.filter((item) => item.id !== id),
          ),
        );
      },
    }),
    /** Resolves to an object URL for the sample. The caller revokes it. */
    previewCharacterVoice: build.mutation<string, string>({
      query: (id) => ({
        url: `characters/${id}/preview`,
        method: "POST",
        responseHandler: async (response) =>
          response.ok ? URL.createObjectURL(await response.blob()) : response.json(),
      }),
    }),
    generateCharacterImage: build.mutation<string, string>({
      query: (prompt) => ({ url: "characters/image", method: "POST", body: { prompt } }),
      transformResponse: (body: { imageKey: string }) => body.imageKey,
    }),
    testCharacterSong: build.mutation<SongTestResult, SongTestInput>({
      query: (body) => ({ url: "characters/song-test", method: "POST", body }),
    }),
    updateCharacterProfile: build.mutation<
      CharacterSummary,
      { id: string; description?: string; personality?: string; speakingStyle?: string; pictureConsent?: boolean }
    >({
      query: ({ id, ...body }) => ({ url: `characters/${id}/profile`, method: "PATCH", body }),
      transformResponse: characterOf,
      onQueryStarted: patchCharacter(),
    }),
    addCharacterMedia: build.mutation<CharacterSummary, { id: string; items: CharacterMediaAdd[] }>({
      query: ({ id, items }) => ({ url: `characters/${id}/media`, method: "POST", body: { items } }),
      transformResponse: characterOf,
      onQueryStarted: patchCharacter(),
    }),
    updateCharacterMedia: build.mutation<
      CharacterSummary,
      { id: string; mediaId: string; label?: string; lookId?: string | null; caption?: string; main?: boolean }
    >({
      query: ({ id, mediaId, ...body }) => ({ url: `characters/${id}/media/${mediaId}`, method: "PATCH", body }),
      transformResponse: characterOf,
      onQueryStarted: patchCharacter(),
    }),
    removeCharacterMedia: build.mutation<CharacterSummary, { id: string; mediaId: string }>({
      query: ({ id, mediaId }) => ({ url: `characters/${id}/media/${mediaId}`, method: "DELETE" }),
      transformResponse: characterOf,
      onQueryStarted: patchCharacter(),
    }),
    addCharacterLook: build.mutation<CharacterSummary, { id: string; name: string; wardrobe?: string }>({
      query: ({ id, ...body }) => ({ url: `characters/${id}/looks`, method: "POST", body }),
      transformResponse: characterOf,
      onQueryStarted: patchCharacter(),
    }),
    updateCharacterLook: build.mutation<CharacterSummary, { id: string; lookId: string; name?: string; wardrobe?: string }>({
      query: ({ id, lookId, ...body }) => ({ url: `characters/${id}/looks/${lookId}`, method: "PATCH", body }),
      transformResponse: characterOf,
      onQueryStarted: patchCharacter(),
    }),
    removeCharacterLook: build.mutation<CharacterSummary, { id: string; lookId: string }>({
      query: ({ id, lookId }) => ({ url: `characters/${id}/looks/${lookId}`, method: "DELETE" }),
      transformResponse: characterOf,
      onQueryStarted: patchCharacter(),
    }),
    voiceFromClip: build.mutation<CharacterSummary, { id: string; samples: Blob[]; consent: true }>({
      query: ({ id, samples, consent }) => {
        const body = new FormData();
        body.set("consent", consent ? "yes" : "no");
        samples.forEach((sample, index) => body.append("samples", new File([sample], `clip-${index + 1}.wav`, { type: "audio/wav" })));
        return { url: `characters/${id}/voice-from-clip`, method: "POST", body };
      },
      transformResponse: characterOf,
      onQueryStarted: patchCharacter(),
    }),
    designVoices: build.mutation<VoicePreview[], string>({
      query: (description) => ({ url: "characters/voice-previews", method: "POST", body: { description } }),
      transformResponse: (body: { previews?: VoicePreview[] }) => body.previews ?? [],
    }),
  }),
});

export const {
  useGetCharactersQuery,
  useSaveCharacterMutation,
  useDeleteCharacterMutation,
  usePreviewCharacterVoiceMutation,
  useGenerateCharacterImageMutation,
  useDesignVoicesMutation,
  useTestCharacterSongMutation,
  useUpdateCharacterProfileMutation,
  useAddCharacterMediaMutation,
  useUpdateCharacterMediaMutation,
  useRemoveCharacterMediaMutation,
  useAddCharacterLookMutation,
  useUpdateCharacterLookMutation,
  useRemoveCharacterLookMutation,
  useVoiceFromClipMutation,
} = charactersApi;
