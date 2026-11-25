import { partnerRoute } from "@/lib/partners/http";
import { retryPartnerVideo } from "@/lib/partners/videos";

/** Tries a failed or canceled video again, as a new video with the same request. Its credits are held now. */
export const POST = partnerRoute((principal, params) => retryPartnerVideo(principal.userId, params.id), 201);
