import { addCharacterMedia, type AddMediaInput } from "@/lib/characters/library";
import { characterRoute, jsonBody } from "@/lib/characters/route-helpers";

/** Adds uploaded pictures and clips. Body: { items: [{ key, label?, lookId?, caption?, durationSec?, sourceMediaId? }] }. */
export const POST = characterRoute(async (userId, { id }, request) => {
  const body = await jsonBody(request);
  const items = Array.isArray(body.items) ? (body.items as AddMediaInput[]) : [];
  const character = await addCharacterMedia(userId, id, items.slice(0, 30));
  return Response.json({ character }, { status: 201 });
});
