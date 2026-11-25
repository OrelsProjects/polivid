import { designPartnerVoices } from "@/lib/partners/characters";
import { jsonBody, partnerRoute } from "@/lib/partners/http";

export const maxDuration = 60;

/** Voices designed from a description, to listen to and pick one. Costs one credit. */
export const POST = partnerRoute((principal) => designPartnerVoices(principal.userId, jsonBody(principal)));
