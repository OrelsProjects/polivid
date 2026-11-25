import { deletePartnerCharacter, getPartnerCharacter, updatePartnerCharacter } from "@/lib/partners/characters";
import { jsonBody, partnerRoute } from "@/lib/partners/http";

export const GET = partnerRoute(async (principal, params) => ({ character: await getPartnerCharacter(principal.userId, params.id) }));

export const PATCH = partnerRoute(async (principal, params) => ({
  character: await updatePartnerCharacter(principal.userId, params.id, jsonBody(principal)),
}));

export const DELETE = partnerRoute((principal, params) => deletePartnerCharacter(principal.userId, params.id));
