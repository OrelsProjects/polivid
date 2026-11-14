# MCP server

PoliVid is an MCP server. Any agent that speaks MCP (Claude Code, Claude Desktop, claude.ai, ChatGPT, Cursor, or your own) can drive every tool in the registry, as the person who connected it.

- Endpoint: `POST /api/mcp`. This is Streamable HTTP, stateless, and returns JSON responses.
- Tools: every entry in `MCP_TOOL_DEFS` (`lib/tools/registry.ts`). There is no second list. A new tool in `lib/tools/defs` shows up here and in the Coach at the same time.
- People connect from **Connect agents** (`/settings/connect`, linked in the account menu).

## Connecting

### API key

Create a key on `/settings/connect` and send it as a Bearer token.

```sh
claude mcp add --transport http polivid https://<host>/api/mcp --header "Authorization: Bearer pv_live_…"
```

```json
{ "mcpServers": { "polivid": { "type": "http", "url": "https://<host>/api/mcp", "headers": { "Authorization": "Bearer pv_live_…" } } } }
```

Keys are stored as sha256 hashes (`ApiKey`). The settings page shows a key once, at creation. Revoking a key takes effect on the next request.

### OAuth (connectors)

Paste `https://<host>/api/mcp` as a custom connector. The client discovers the rest on its own:

| Step | Endpoint |
| --- | --- |
| 401 with `WWW-Authenticate: Bearer resource_metadata=…` | `/api/mcp` |
| Protected resource metadata (RFC 9728) | `/.well-known/oauth-protected-resource/api/mcp`, also served at the root |
| Authorization server metadata (RFC 8414) | `/.well-known/oauth-authorization-server` |
| Dynamic client registration (RFC 7591), public clients only | `POST /api/oauth/register` |
| Consent page (signed in), PKCE S256 required | `/oauth/authorize` |
| Code and refresh exchange | `POST /api/oauth/token` |
| Revocation (RFC 7009) | `POST /api/oauth/revoke` |

Rules:

- Redirect URIs must be https, loopback http (any port on loopback, RFC 8252), or a private-use app scheme such as `cursor://`.
- Codes last 10 minutes and work once.
- Access tokens last 1 hour. Refresh tokens last 30 days and rotate on every use.
- If a refresh token is reused, every token that client holds for that person is revoked.
- The one scope is `mcp`.

Set `APP_PUBLIC_URL` in production. It names the issuer and the resource. Locally, the request origin is used.

## Who the tools run as

`resolveBearer` (`lib/mcp/auth/principal.ts`) maps the token to a user id. The user id never comes from the request body.

Each call gets a `ToolContext` with that user, no chat attachments, and the timezone from the optional `X-Timezone` header (UTC otherwise). Remote agents attach media by passing upload keys.

## Spending credits: quote, then confirm

Tools with `approval: "user"` spend credits or can't be undone, and they run in two calls. The MCP listing adds an optional `confirmToken` field to those tools. The registry schema itself does not change.

1. **First call, without `confirmToken`.** The adapter prices the call with `priceToolCall` (`lib/tools/lookup-credits.ts`), the same pricing the Coach uses. It stores a `SpendQuote` and returns:

   ```json
   { "needsConfirmation": true, "credits": 65, "balance": 6760, "detail": "prompt · 9:16 · 5s", "confirmToken": "pvq_…", "expiresAt": "…", "next": "…" }
   ```

   Nothing runs.
2. **Second call: the same arguments plus `confirmToken`.** The token is bound to the user, the tool, and a hash of the canonical input (`lib/mcp/canonical.ts`). It must be unused and less than 10 minutes old. Any change to the arguments is refused, and the agent has to get a fresh quote.

Destructive tools that cost nothing (cancel, restore) go through the same flow and quote `credits: 0`.

## Files

| Path | What it is |
| --- | --- |
| `app/api/mcp/route.ts` | Auth, then one stateless `Server` and transport per request |
| `lib/mcp/server.ts` | `callMcpTool`: validate, quote or redeem, run the handler, shape the result |
| `lib/mcp/tool-list.ts` | Tool listing (JSON Schema, annotations, `confirmToken`) and the server `instructions` |
| `lib/mcp/confirm.ts`, `lib/mcp/canonical.ts` | Quote and redeem |
| `lib/mcp/auth/*` | Tokens, PKCE, redirect rules, the key/client/token store, the authorize check |
| `app/.well-known/*`, `app/api/oauth/*`, `app/oauth/authorize` | OAuth endpoints and the consent page |
| `app/(app)/settings/connect` | Keys, connected apps, config snippets |

## Results

- A handler's return value is sent as `structuredContent`, plus the same value as a JSON text block.
- `{ error }` results set `isError: true`.
- Arguments are validated against the tool's Zod schema before anything runs.

## Test

- `npm test` covers PKCE (RFC 7636 vectors), redirect rules, token kinds, canonical hashing, the listing (an object schema, and `confirmToken` exactly on the approval tools), and the rate limiter.
- For a live check, run `npx @modelcontextprotocol/inspector` against `http://localhost:3100/api/mcp`, either with a key or through the OAuth flow.
