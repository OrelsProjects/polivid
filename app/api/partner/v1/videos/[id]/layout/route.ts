import { jsonBody, partnerRoute } from "@/lib/partners/http";
import { layoutPartnerVideo } from "@/lib/partners/videos";

/** Re-edits a finished video in a layout style, as a new video. The original is kept. */
export const POST = partnerRoute((principal, params) => layoutPartnerVideo(principal.userId, params.id, jsonBody(principal)), 202);
