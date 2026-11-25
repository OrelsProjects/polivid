import { jsonBody, partnerRoute } from "@/lib/partners/http";
import { createPartnerVideo, listPartnerVideos } from "@/lib/partners/videos";

export const GET = partnerRoute(async (principal) => ({ videos: await listPartnerVideos(principal.userId) }));

/** Starts a UGC ad, talking avatar, captioned upload, or faceless short. Its credits are held now. */
export const POST = partnerRoute((principal) => createPartnerVideo(principal.userId, jsonBody(principal)), 202);
