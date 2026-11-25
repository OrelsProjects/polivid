import { drawPartnerPortrait } from "@/lib/partners/characters";
import { jsonBody, partnerRoute } from "@/lib/partners/http";

export const maxDuration = 120;

/** A portrait drawn from a description, for a person with no photo. Costs one credit. */
export const POST = partnerRoute((principal) => drawPartnerPortrait(principal.userId, jsonBody(principal)), 201);
