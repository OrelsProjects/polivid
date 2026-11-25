import { addPartnerPictures } from "@/lib/partners/characters";
import { jsonBody, partnerRoute } from "@/lib/partners/http";

/** Adds pictures of the same person. Body: { pictures: [{ key, label? }] }. Free. */
export const POST = partnerRoute(
  async (principal, params) => ({ character: await addPartnerPictures(principal.userId, params.id, jsonBody(principal)) }),
  201,
);
