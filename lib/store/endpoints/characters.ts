import type { CharacterSummary } from "@/lib/characters/types";
import { api } from "../api";

export type VoicePreview = { generatedVoiceId: string; audioBase64: string };

export type SongTestInput = { characterId: string; style: string; lyrics: string; length: number };
export type SongTestResult = { original: string; vocal: string; sung: string; mix: string };

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
} = charactersApi;
