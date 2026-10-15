import { auth } from "@/auth";
import { rangedBytesResponse } from "@/lib/http/range";
import { loadProductionAsset } from "@/lib/production/asset-cache";
import { getAssetForUser } from "@/lib/production/store";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in first.", { status: 401 });
  const { assetId } = await context.params;
  const asset = await getAssetForUser(userId, assetId);
  if (!asset) return new Response("Not found.", { status: 404 });
  const etag = `"${asset.sha256.slice(0, 32)}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "private, max-age=3600" } });
  }
  const { bytes, contentType } = await loadProductionAsset(asset);
  const response = rangedBytesResponse(bytes, contentType, request.headers.get("range"), "private, max-age=3600");
  response.headers.set("ETag", etag);
  return response;
}
