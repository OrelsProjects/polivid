import { removePartnerPicture, updatePartnerPicture } from "@/lib/partners/characters";
import { jsonBody, partnerRoute } from "@/lib/partners/http";

/** Relabels a picture or makes it the main one. Body: { label? , main?: true }. */
export const PATCH = partnerRoute(async (principal, params) => ({
  character: await updatePartnerPicture(principal.userId, params.id, params.pictureId, jsonBody(principal)),
}));

export const DELETE = partnerRoute(async (principal, params) => ({
  character: await removePartnerPicture(principal.userId, params.id, params.pictureId),
}));
