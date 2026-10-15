import { auth } from "@/auth";
import { rangedBytesResponse } from "@/lib/http/range";
import { overwriteProductionBytes, readProductionBytes } from "@/lib/production/assets";
import { healProductionMedia } from "@/lib/production/placeholder-media";
import { getAssetForUser } from "@/lib/production/store";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in first.", { status: 401 });
  const { assetId } = await context.params;
  const asset = await getAssetForUser(userId, assetId);
  if (!asset) return new Response("Not found.", { status: 404 });
  let { bytes, contentType } = await readProductionBytes(asset.storageKey);
  const healed = await healProductionMedia(asset.kind, bytes, contentType, asset.id);
  if (healed) {
    await overwriteProductionBytes(asset.storageKey, healed.bytes, healed.contentType);
    bytes = healed.bytes;
    contentType = healed.contentType;
  }
  return rangedBytesResponse(bytes, contentType, request.headers.get("range"), "private, no-store");
}
