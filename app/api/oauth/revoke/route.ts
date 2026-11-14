import { readParams } from "@/lib/mcp/auth/form";
import { revokeOAuthToken } from "@/lib/mcp/auth/store";
import { corsPreflight, withCors } from "@/lib/mcp/origin";

/** RFC 7009. Always 200, so a caller can't probe which tokens exist. */
export async function POST(request: Request) {
  const params = await readParams(request);
  if (params.token) await revokeOAuthToken(params.token);
  return withCors(new Response(null, { status: 200 }));
}

export const OPTIONS = () => corsPreflight();
