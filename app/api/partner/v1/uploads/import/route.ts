import { jsonBody, PartnerError, partnerRoute } from "@/lib/partners/http";
import { importMediaFromUrl } from "@/lib/storage/import-url";

export const maxDuration = 60;

/** Copies a picture, recording, or clip from a public link into this person's uploads, and returns its key. */
export const POST = partnerRoute(async (principal) => {
  const url = jsonBody(principal).url;
  if (typeof url !== "string" || !url.trim()) throw new PartnerError("invalid", "Send the file's url.");
  const result = await importMediaFromUrl(principal.userId, url.trim());
  if ("error" in result) throw new PartnerError("invalid", result.error);
  return { key: result.key, kind: result.kind, contentType: result.contentType, bytes: result.bytes };
}, 201);
