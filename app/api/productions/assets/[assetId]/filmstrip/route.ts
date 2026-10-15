import { auth } from "@/auth";
import { loadFilmstrip } from "@/lib/production/filmstrip";
import { getAssetForUser } from "@/lib/production/store";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return new Response("Sign in first.", { status: 401 });
  const { assetId } = await context.params;
  const asset = await getAssetForUser(userId, assetId);
  if (!asset || asset.kind !== "video") return new Response("Not found.", { status: 404 });

  try {
    const { bytes, meta } = await loadFilmstrip(asset);
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=3600",
        "X-Filmstrip-Interval": String(meta.interval),
        "X-Filmstrip-Count": String(meta.count),
        "X-Filmstrip-Tile": String(meta.tile),
      },
    });
  } catch (error) {
    console.error("Could not build a filmstrip.", error);
    return new Response("Could not build a filmstrip.", { status: 500 });
  }
}
