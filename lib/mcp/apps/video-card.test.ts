import assert from "node:assert/strict";
import test from "node:test";
import { MCP_TOOL_DEFS } from "@/lib/tools/registry";
import { listMcpTools } from "../tool-list";
import { hasVideoCard, withVideoCard } from "./card-data";
import { MCP_APP_MIME_TYPE, VIDEO_CARD_URI, videoCardHtml, videoCardResourceMeta } from "./video-card";

const ORIGIN = "https://www.example.com";

test("the card page is self-contained apart from the PoliVid origin", () => {
  const html = videoCardHtml(ORIGIN);
  assert.match(html, /^<!doctype html>/);
  assert.ok(html.includes(`data-origin="${ORIGIN}"`));
  assert.ok(html.includes("ui/initialize") && html.includes("ui/notifications/tool-result") && html.includes("tools/call"));
  assert.ok(html.includes("2026-01-26"));
  assert.ok(!html.includes("${"), "no unfilled template slots");
  const sources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  for (const source of sources) assert.ok(source.startsWith(ORIGIN), source);
  assert.equal(MCP_APP_MIME_TYPE, "text/html;profile=mcp-app");
  assert.deepEqual(videoCardResourceMeta(ORIGIN).ui.csp.resourceDomains, [ORIGIN]);
});

test("make, get, and retry tools point at the card; others don't", () => {
  const tools = listMcpTools();
  for (const definition of MCP_TOOL_DEFS) {
    const listed = tools.find((tool) => tool.name === definition.name)!;
    const uri = (listed._meta as { ui?: { resourceUri?: string } } | undefined)?.ui?.resourceUri;
    assert.equal(uri === VIDEO_CARD_URI, hasVideoCard(definition), definition.name);
  }
  assert.ok(hasVideoCard({ name: "make_prompt_video", videoMode: "prompt" }));
  assert.ok(hasVideoCard({ name: "get_video" }));
  assert.ok(!hasVideoCard({ name: "edit_trim" }));
});

test("card data adds a page link, and a playback link only when ready", () => {
  const sign = (id: string) => `${ORIGIN}/api/editor/assets/token-for-${id}`;
  const queued = withVideoCard({ jobId: "j1", credits: 65 }, ORIGIN, sign) as { card: Record<string, string> };
  assert.equal(queued.card.pageUrl, `${ORIGIN}/videos/j1`);
  assert.equal(queued.card.playUrl, undefined);
  const ready = withVideoCard({ id: "j1", status: "succeeded", ready: true }, ORIGIN, sign) as { card: Record<string, string> };
  assert.equal(ready.card.playUrl, `${ORIGIN}/api/editor/assets/token-for-j1`);
  const quote = { needsConfirmation: true, credits: 65 };
  assert.equal(withVideoCard(quote, ORIGIN, sign), quote);
  const error = { error: "nope" };
  assert.equal(withVideoCard(error, ORIGIN, sign), error);
});
