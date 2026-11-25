import { PartnerError, partnerRoute } from "@/lib/partners/http";
import { partnerVideoView } from "@/lib/partners/videos";

/** Where a video stands, and a link to its file once it's done. The link works for a day. */
export const GET = partnerRoute(async (principal, params) => {
  const video = await partnerVideoView(principal.userId, params.id);
  if (!video) throw new PartnerError("not_found", "That video doesn't exist.");
  return { video };
});
