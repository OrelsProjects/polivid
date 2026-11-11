import assert from "node:assert/strict";
import test from "node:test";
import { decodeEntities, extractPage, htmlToText } from "./extract-article";

const PARA_ONE =
  "Sleep is when the brain files the day away. Researchers have watched the same patterns of activity replay during deep sleep that fired while a person was learning.";
const PARA_TWO =
  "That replay is thought to move memories into long-term storage, which is why a night of rest often makes yesterday's hard problem look simpler in the morning.";

const page = (body: string, head = "") =>
  `<!doctype html><html><head><title>Why sleep matters &amp; how | Example News</title>${head}</head><body>${body}</body></html>`;

test("entities and tags become plain paragraphs", () => {
  assert.equal(decodeEntities("Tom &amp; Jerry &#8212; &#x201C;hi&#x201D; &nbsp;&unknown;"), "Tom & Jerry — “hi”  &unknown;");
  assert.equal(htmlToText("<p>One&nbsp;two</p><p>Three <b>four</b></p><script>alert(1)</script>"), "One two\nThree four");
});

test("the article element wins over the page furniture around it", () => {
  const html = page(
    `<nav><a href="/">Home</a><a href="/news">News</a></nav>
     <article><h1>Why sleep matters</h1><p>${PARA_ONE}</p><p>${PARA_TWO}</p></article>
     <aside><p>Sign up for our newsletter and get the best stories every single morning in your inbox.</p></aside>
     <footer>© Example News</footer>`,
  );
  const result = extractPage(html);
  assert.equal(result.title, "Why sleep matters & how | Example News");
  assert.ok(result.text.includes(PARA_ONE));
  assert.ok(result.text.includes(PARA_TWO));
  assert.equal(result.text.includes("newsletter"), false);
  assert.equal(result.text.includes("Home"), false);
  assert.equal(result.text.includes("<"), false);
});

test("structured data is used when the markup has no article", () => {
  const head = `<meta property="og:title" content="Sleep, explained"><script type="application/ld+json">${JSON.stringify({
    "@graph": [{ "@type": "WebSite" }, { "@type": "NewsArticle", headline: "Ignored", articleBody: `${PARA_ONE} ${PARA_TWO}` }],
  })}</script>`;
  const result = extractPage(page(`<div id="app"></div>`, head));
  assert.equal(result.title, "Sleep, explained");
  assert.equal(result.text, `${PARA_ONE} ${PARA_TWO}`);
});

test("a page with neither falls back to its prose, without menus", () => {
  const html = page(`<div><a>Menu</a><a>Login</a></div><div><p>${PARA_ONE}</p><p>${PARA_TWO}</p></div><div>Share</div>`);
  const result = extractPage(html);
  assert.ok(result.text.startsWith("Sleep is when"));
  assert.equal(result.text.includes("Menu"), false);
  assert.equal(result.text.includes("Share"), false);
});

test("an app shell with only a description returns that description", () => {
  const html = page(`<div id="root"></div>`, `<meta name="description" content="A short summary of the page.">`);
  assert.equal(extractPage(html).text, "A short summary of the page.");
});

test("broken structured data and scripts do not break or leak into the text", () => {
  const html = page(
    `<article><p>${PARA_ONE}</p><script>var secret = "token";</script><style>p{color:red}</style><p>${PARA_TWO}</p></article>`,
    `<script type="application/ld+json">{ not json</script>`,
  );
  const result = extractPage(html);
  assert.equal(result.text.includes("secret"), false);
  assert.equal(result.text.includes("color"), false);
  assert.ok(result.text.includes(PARA_TWO));
});

test("long pages are cut at a sentence, inside the limit", () => {
  const long = Array.from({ length: 80 }, () => PARA_ONE).join(" ");
  const result = extractPage(page(`<article><p>${long}</p></article>`), { limit: 1000 });
  assert.ok(result.text.length <= 1000);
  assert.ok(result.text.length > 600);
  assert.match(result.text, /\.$/);
});

test("plain text passes through", () => {
  assert.deepEqual(extractPage("Just some notes.\n\n\n\nSecond line."), { title: "", text: "Just some notes.\n\nSecond line." });
  assert.equal(extractPage("a < b and c > d", { plainText: true }).text, "a < b and c > d");
});

test("footnote markers and edit links are dropped, and punctuation closes up", () => {
  assert.equal(
    htmlToText('<h2>History <span>[ edit ]</span></h2><p><a href="/m">Memory</a> , the process<sup>[1]</sup> of <b>storing</b> .</p>'),
    "History [ edit ]\nMemory, the process of storing.",
  );
  assert.equal(htmlToText("<p>[ edit ]</p><p>Kept.</p>"), "Kept.");
});
