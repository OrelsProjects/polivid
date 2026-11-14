import { removeCharacterMedia, updateCharacterMedia } from "@/lib/characters/library";
import { characterRoute, jsonBody } from "@/lib/characters/route-helpers";

/** Label, look, caption, or make it the main picture. */
export const PATCH = characterRoute(async (userId, { id, mediaId }, request) => {
  const character = await updateCharacterMedia(userId, id, mediaId, await jsonBody(request));
  return Response.json({ character });
});

export const DELETE = characterRoute(async (userId, { id, mediaId }) => {
  const character = await removeCharacterMedia(userId, id, mediaId);
  return Response.json({ character });
});
