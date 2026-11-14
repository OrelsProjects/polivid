import { updateCharacterProfile } from "@/lib/characters/library";
import { characterRoute, jsonBody } from "@/lib/characters/route-helpers";

/** Name, description, personality, speaking style, and consent. */
export const PATCH = characterRoute(async (userId, { id }, request) => {
  const body = await jsonBody(request);
  const character = await updateCharacterProfile(userId, id, body);
  return Response.json({ character });
});
