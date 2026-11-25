import { jsonBody, partnerRoute } from "@/lib/partners/http";
import { quotePartnerVideo } from "@/lib/partners/videos";

/** What a video would cost. Nothing is made or charged. */
export const POST = partnerRoute((principal) => quotePartnerVideo(principal.userId, jsonBody(principal)));
