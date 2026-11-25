import { partnerRoute } from "@/lib/partners/http";
import { cancelPartnerVideo } from "@/lib/partners/videos";

/** Stops a video in progress. Its held credits are given back. */
export const POST = partnerRoute((principal, params) => cancelPartnerVideo(principal.userId, params.id));
