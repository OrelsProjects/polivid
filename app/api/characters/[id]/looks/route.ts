import { addCharacterLook } from "@/lib/characters/library";
import { characterRoute, jsonBody } from "@/lib/characters/route-helpers";

export const POST = characterRoute(async (userId, { id }, request) => {
  const result = await addCharacterLook(userId, id, await jsonBody(request));
  return Response.json(result, { status: 201 });
});
