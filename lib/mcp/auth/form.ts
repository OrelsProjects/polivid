/** OAuth token and revoke requests are form-encoded, but some clients send JSON. Accept both. */
export const readParams = async (request: Request): Promise<Record<string, string>> => {
  const type = request.headers.get("content-type") ?? "";
  const out: Record<string, string> = {};
  if (type.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    for (const [key, value] of Object.entries(body ?? {})) if (typeof value === "string") out[key] = value;
    return out;
  }
  const form = new URLSearchParams(await request.text().catch(() => ""));
  for (const [key, value] of form) out[key] = value;
  return out;
};

export const oauthError = (error: string, description: string, status = 400) =>
  Response.json({ error, error_description: description }, { status, headers: { "Cache-Control": "no-store" } });
