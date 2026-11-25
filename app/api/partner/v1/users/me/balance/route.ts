import { partnerBalance } from "@/lib/partners/allowance";
import { partnerRoute } from "@/lib/partners/http";

/** The video credits this person has left. */
export const GET = partnerRoute((principal) => partnerBalance(principal.userId));
