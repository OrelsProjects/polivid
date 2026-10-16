"use client";

import { skipToken } from "@reduxjs/toolkit/query";
import type { CharacterSummary } from "@/lib/characters/types";
import { useGetCharactersQuery } from "@/lib/store/endpoints/characters";

const NO_CHARACTERS: CharacterSummary[] = [];

/** The signed-in person's characters, or an empty list until they load. */
export const useCharacters = (enabled = true) => {
  const { data } = useGetCharactersQuery(enabled ? undefined : skipToken);
  return data ?? NO_CHARACTERS;
};
