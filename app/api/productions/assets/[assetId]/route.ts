import { auth } from "@/auth";
import { rangedBytesResponse } from "@/lib/http/range";
import { readProductionBytes } from "@/lib/production/assets";
import { getAssetForUser } from "@/lib/production/store";

export async function GET(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in first.", { status: 401 });
  const { assetId } = await context.params;
  const asset = await getAssetForUser(userId, assetId);
  if (!asset) return new Response("Not found.", { status: 404 });
  const { bytes, contentType } = await readProductionBytes(asset.storageKey);
  return rangedBytesResponse(bytes, contentType, request.headers.get("range"), "private, max-age=300");
}
