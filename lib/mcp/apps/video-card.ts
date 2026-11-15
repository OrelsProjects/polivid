/**
 * The PoliVid video card: an MCP App (io.modelcontextprotocol/ui) that hosts like Claude render
 * inline when an agent makes or checks a video. It shows the PoliVid brand, live progress, and
 * the finished video with a link back to the app.
 *
 * The page is self-contained. It talks to the host over postMessage JSON-RPC (ui/initialize,
 * ui/notifications/tool-result, tools/call via the host, ui/open-link, size changes), and loads
 * only the logo and the video file from the PoliVid origin.
 */

export const VIDEO_CARD_URI = "ui://polivid/video-card.html";
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";
export const MCP_APPS_PROTOCOL_VERSION = "2026-01-26";

/** Resource metadata: the only origin the card loads from is PoliVid's own. */
export const videoCardResourceMeta = (origin: string) => ({
  ui: {
    csp: { resourceDomains: [origin], connectDomains: [] as string[] },
    prefersBorder: false,
  },
});

/** Tool metadata pointing the host at the card. The flat key is the older form some hosts still read. */
export const videoCardToolMeta = () => ({
  ui: { resourceUri: VIDEO_CARD_URI },
  "ui/resourceUri": VIDEO_CARD_URI,
});

const CSS = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: transparent; }
body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #f4f4f5; }
.card { background: #0b0b0d; border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.head { display: flex; align-items: center; gap: 10px; }
.logo { width: 28px; height: 28px; border-radius: 7px; box-shadow: 0 2px 10px -2px rgba(88,28,180,0.7); outline: 1px solid rgba(255,255,255,0.18); }
.brand { font-weight: 700; font-size: 15px; letter-spacing: -0.01em; }
.chip { margin-left: auto; font-size: 12px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.08); color: #d4d4d8; white-space: nowrap; }
.chip.ok { background: rgba(34,197,94,0.16); color: #86efac; }
.chip.bad { background: rgba(239,68,68,0.16); color: #fca5a5; }
.chip.wait { background: rgba(168,85,247,0.18); color: #d8b4fe; }
.title { font-size: 14px; color: #e4e4e7; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.meta { font-size: 12px; color: #a1a1aa; }
.bar { height: 8px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden; }
.fill { height: 100%; width: 0; border-radius: 999px; background: linear-gradient(90deg, #7c3aed, #c084fc); transition: width 0.6s ease; }
.fill.pulse { animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity: 0.65; } 50% { opacity: 1; } }
.row { display: flex; justify-content: space-between; font-size: 12px; color: #a1a1aa; }
.stage { width: 100%; border-radius: 12px; overflow: hidden; background: #000; display: flex; justify-content: center; }
video { display: block; max-width: 100%; max-height: 520px; background: #000; }
.actions { display: flex; gap: 8px; flex-wrap: wrap; }
button { font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; border-radius: 999px; padding: 8px 14px; border: 1px solid rgba(255,255,255,0.14); background: transparent; color: #f4f4f5; }
button.primary { background: #fff; color: #0b0b0d; border-color: #fff; }
button.approve { background: #7c3aed; border-color: #7c3aed; color: #fff; }
button:disabled { opacity: 0.55; cursor: default; }
button:focus-visible { outline: 2px solid #c084fc; outline-offset: 2px; }
.note { font-size: 13px; color: #d4d4d8; line-height: 1.5; }
.err { font-size: 13px; color: #fca5a5; line-height: 1.5; }
.hidden { display: none !important; }
`;

/** Runs in the sandboxed iframe. Plain ES2019 with no template literals inside, so the only substitution is the protocol version. */
const SCRIPT = String.raw`
(function () {
  var ORIGIN = document.documentElement.getAttribute("data-origin") || "";
  var nextId = 1;
  var pending = {};
  var host = { serverTools: false, openLinks: false };
  var state = { videoId: "", pollTimer: 0, polls: 0, last: null, quote: null, busy: false };
  var MAX_POLLS = 360;

  function send(message) { window.parent.postMessage(message, "*"); }
  function request(method, params) {
    var id = nextId++;
    send({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    return new Promise(function (resolve, reject) {
      pending[id] = { resolve: resolve, reject: reject };
      setTimeout(function () { if (pending[id]) { delete pending[id]; reject(new Error("timeout")); } }, 30000);
    });
  }
  function notify(method, params) { send({ jsonrpc: "2.0", method: method, params: params || {} }); }
  function $(id) { return document.getElementById(id); }
  function show(id, on) { $(id).classList.toggle("hidden", !on); }

  function reportSize() {
    var el = $("card");
    notify("ui/notifications/size-changed", { height: Math.ceil(el.getBoundingClientRect().height) + 2 });
  }

  function chip(text, kind) {
    var c = $("chip");
    c.textContent = text;
    c.className = "chip" + (kind ? " " + kind : "");
  }

  function pageUrl(id) { return ORIGIN + "/videos/" + encodeURIComponent(id); }

  function openApp() {
    var waiting = state.last && state.last.needsConfirmation && state.quote && state.quote.id;
    openUrl(state.videoId ? pageUrl(state.videoId) : waiting ? approvePage() : ORIGIN + "/videos");
  }

  function dataOf(result) {
    if (!result) return null;
    if (result.structuredContent && typeof result.structuredContent === "object") return result.structuredContent;
    var block = (result.content || []).find(function (item) { return item && item.type === "text"; });
    if (!block) return null;
    try { return JSON.parse(block.text); } catch (e) { return null; }
  }

  function render(data) {
    if (!data) return;
    state.last = data;
    var card = data.card || {};
    show("progress", false); show("stage", false); show("error", false); show("note", false);
    showDecision(false);

    if (data.error) {
      chip("Couldn't do that", "bad");
      $("error").textContent = data.error;
      show("error", true);
      reportSize();
      return;
    }

    if (data.needsConfirmation) {
      chip("Waiting for your OK", "wait");
      $("title").textContent = data.detail || "Ready to make your video";
      var cost = typeof data.credits === "number" ? (data.credits === 0 ? "No credits" : data.credits + " credits") : "Priced when it runs";
      $("meta").textContent = cost + " · " + (typeof data.balance === "number" ? data.balance + " credits left" : "");
      $("note").textContent = "Nothing has started. Approve it here, or tell Claude to go ahead.";
      show("note", true);
      state.quote = { token: data.confirmToken || "", id: data.quoteId || "" };
      showDecision(Boolean(state.quote.token || state.quote.id));
      reportSize();
      return;
    }

    if (data.declined === true || data.settled === "declined") {
      chip("Declined");
      $("note").textContent = "Declined. Nothing was started or charged.";
      show("note", true);
      stopPolling();
      reportSize();
      return;
    }

    var id = card.videoId || data.jobId || data.id || "";
    if (id) state.videoId = id;
    if (data.prompt || card.title) $("title").textContent = card.title || data.prompt;
    var parts = [];
    if (data.format) parts.push(data.format);
    if (data.length) parts.push(data.length + "s");
    if (data.mode) parts.push(data.mode);
    if (typeof data.credits === "number" && data.jobId) parts.push(data.credits + " credits");
    $("meta").textContent = parts.join(" · ");

    var status = data.status || (data.jobId ? "queued" : "");
    if (data.ready || status === "succeeded" || status === "ready") {
      chip("Ready", "ok");
      if (card.playUrl) {
        var v = $("video");
        if (v.getAttribute("src") !== card.playUrl) v.setAttribute("src", card.playUrl);
        show("stage", true);
      } else {
        $("note").textContent = "Your video is ready in PoliVid.";
        show("note", true);
      }
      stopPolling();
    } else if (status === "failed" || status === "canceled" || data.needsModel) {
      chip(data.needsModel ? "Needs another model" : status === "canceled" ? "Canceled" : "Failed", "bad");
      $("error").textContent = data.error || (data.next || "Open it in PoliVid for details.");
      show("error", true);
      stopPolling();
    } else if (status === "paused") {
      chip("Paused");
      $("note").textContent = data.next || "Paused. Resume it from PoliVid or ask Claude.";
      show("note", true);
      stopPolling();
    } else {
      chip(status === "queued" ? "Queued" : "Making it");
      var pct = Math.max(3, Math.min(99, Number(data.progressPct) || 0));
      $("fill").style.width = pct + "%";
      $("fill").classList.toggle("pulse", !data.progressPct);
      var label = data.stepLabel || (status === "queued" ? "Waiting to start" : "Working");
      if (data.clipIndex && data.clipTotal > 1) label += " · clip " + data.clipIndex + " of " + data.clipTotal;
      $("step").textContent = label;
      $("pct").textContent = data.progressPct ? Math.round(data.progressPct) + "%" : "";
      show("progress", true);
      startPolling();
    }
    reportSize();
  }

  function showDecision(on) {
    show("approve", on); show("decline", on);
    $("approve").disabled = state.busy; $("decline").disabled = state.busy;
  }
  function approvePage() {
    if (!state.quote || !state.quote.id) return ORIGIN + "/videos";
    return ORIGIN + "/approve/" + encodeURIComponent(state.quote.id);
  }
  function openUrl(url) {
    if (host.openLinks) request("ui/open-link", { url: url }).catch(function () { window.open(url, "_blank"); });
    else window.open(url, "_blank");
  }
  /** Tells the model what the person chose, where the host supports it. Best effort. */
  function tellModel(text) {
    request("ui/update-model-context", { content: [{ type: "text", text: text }] }).catch(function () {});
  }
  function fallbackToPage(text) {
    state.busy = false;
    showDecision(true);
    $("note").textContent = text;
    show("note", true);
    openUrl(approvePage());
    reportSize();
  }
  function decide(approve) {
    if (state.busy || !state.quote) return;
    if (!host.serverTools || !state.quote.token) {
      fallbackToPage("Finish in the PoliVid tab that just opened.");
      return;
    }
    state.busy = true;
    showDecision(true);
    chip(approve ? "Starting" : "Declining", "wait");
    var name = approve ? "confirm_spend" : "decline_spend";
    request("tools/call", { name: name, arguments: { confirmToken: state.quote.token, via: "card" } })
      .then(function (result) {
        state.busy = false;
        var data = dataOf(result);
        if (!data) throw new Error("empty");
        render(data);
        var job = data.jobId || (data.card && data.card.videoId) || "";
        if (approve && !data.error && !data.needsConfirmation) {
          tellModel("The person approved the quote on the PoliVid card. The video has started" + (job ? " (jobId " + job + "). Poll get_video with it." : ".") + " Don't call confirm_spend for it again.");
        } else if (!approve && data.declined) {
          tellModel("The person declined the quote on the PoliVid card. Nothing was started or charged.");
        }
      })
      .catch(function () {
        fallbackToPage("The chat couldn't reach PoliVid, so it opened in a new tab. Approve or decline there.");
      });
  }

  function poll() {
    if (!state.videoId || !host.serverTools) return;
    state.polls += 1;
    if (state.polls > MAX_POLLS) { stopPolling(); return; }
    request("tools/call", { name: "get_video", arguments: { videoId: state.videoId } })
      .then(function (result) { render(dataOf(result)); })
      .catch(function () { /* the next tick tries again */ });
  }
  function startPolling() {
    if (state.pollTimer || !host.serverTools || !state.videoId) return;
    state.pollTimer = setInterval(poll, 5000);
  }
  function stopPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = 0;
  }

  window.addEventListener("message", function (event) {
    if (event.source !== window.parent) return;
    var msg = event.data;
    if (!msg || msg.jsonrpc !== "2.0") return;
    if (msg.id !== undefined && !msg.method) {
      var waiter = pending[msg.id];
      if (!waiter) return;
      delete pending[msg.id];
      if (msg.error) waiter.reject(msg.error); else waiter.resolve(msg.result);
      return;
    }
    if (msg.method === "ui/notifications/tool-result") { render(dataOf(msg.params)); return; }
    if (msg.method === "ui/notifications/tool-cancelled") { chip("Canceled", "bad"); stopPolling(); return; }
    if (msg.method === "ui/resource-teardown" && msg.id !== undefined) {
      stopPolling();
      send({ jsonrpc: "2.0", id: msg.id, result: {} });
      return;
    }
    if (msg.id !== undefined && msg.method) {
      send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "Method not found" } });
    }
  });

  $("open").addEventListener("click", openApp);
  $("approve").addEventListener("click", function () { decide(true); });
  $("decline").addEventListener("click", function () { decide(false); });
  if (window.ResizeObserver) new ResizeObserver(reportSize).observe($("card"));

  request("ui/initialize", {
    appInfo: { name: "polivid-video-card", version: "1.0.0" },
    appCapabilities: {},
    protocolVersion: "${MCP_APPS_PROTOCOL_VERSION}",
  }).then(function (result) {
    var caps = (result && result.hostCapabilities) || {};
    host.serverTools = Boolean(caps.serverTools);
    host.openLinks = Boolean(caps.openLinks);
    notify("ui/notifications/initialized", {});
    if (state.last) render(state.last);
    reportSize();
  }).catch(function () { reportSize(); });
})();
`;

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The card page for one PoliVid origin. */
export const videoCardHtml = (origin: string) => `<!doctype html>
<html lang="en" data-origin="${escapeAttribute(origin)}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>PoliVid</title>
<style>${CSS}</style>
</head>
<body>
<div class="card" id="card">
  <div class="head">
    <img class="logo" src="${escapeAttribute(origin)}/brand/polivid-icon-96.png" alt="" width="28" height="28" />
    <span class="brand">PoliVid</span>
    <span class="chip" id="chip">Starting</span>
  </div>
  <div>
    <div class="title" id="title">Your video</div>
    <div class="meta" id="meta"></div>
  </div>
  <div id="progress" class="hidden">
    <div class="bar"><div class="fill pulse" id="fill"></div></div>
    <div class="row" style="margin-top:8px"><span id="step">Working</span><span id="pct"></span></div>
  </div>
  <div class="stage hidden" id="stage"><video id="video" controls playsinline preload="metadata"></video></div>
  <div class="note hidden" id="note"></div>
  <div class="err hidden" id="error"></div>
  <div class="actions">
    <button class="approve hidden" id="approve" type="button">Approve</button>
    <button class="hidden" id="decline" type="button">Decline</button>
    <button class="primary" id="open" type="button">Open in PoliVid</button>
  </div>
</div>
<script>${SCRIPT}</script>
</body>
</html>`;
