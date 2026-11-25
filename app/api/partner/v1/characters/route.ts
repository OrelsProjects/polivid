import { createPartnerCharacter, listPartnerCharacters } from "@/lib/partners/characters";
import { jsonBody, partnerRoute } from "@/lib/partners/http";

export const maxDuration = 60;

export const GET = partnerRoute(async (principal) => ({ characters: await listPartnerCharacters(principal.userId) }));

/** Saves a character from a photo and a voice. Both consents are required. */
export const POST = partnerRoute(async (principal) => ({ character: await createPartnerCharacter(principal.userId, jsonBody(principal)) }), 201);
