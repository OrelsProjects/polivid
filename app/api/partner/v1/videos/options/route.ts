import { partnerRoute } from "@/lib/partners/http";
import { partnerVideoOptions } from "@/lib/partners/videos";

/** The layout styles and caption looks a video can be finished in. */
export const GET = partnerRoute(async () => partnerVideoOptions());
