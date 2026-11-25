import { setPartnerAllowance } from "@/lib/partners/allowance";
import { jsonBody, partnerRoute } from "@/lib/partners/http";

/** Sets this person's video credits from their plan. Call it when the plan starts, changes, or renews. */
export const PUT = partnerRoute((principal) => setPartnerAllowance(principal.partnerId, principal.userId, jsonBody(principal)));
