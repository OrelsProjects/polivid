import { removeCharacterLook, updateCharacterLook } from "@/lib/characters/library";
import { characterRoute, jsonBody } from "@/lib/characters/route-helpers";

export const PATCH = characterRoute(async (userId, { id, lookId }, request) => {
  const character = await updateCharacterLook(userId, id, lookId, await jsonBody(request));
  return Response.json({ character });
});

export const DELETE = characterRoute(async (userId, { id, lookId }) => {
  const character = await removeCharacterLook(userId, id, lookId);
  return Response.json({ character });
});
