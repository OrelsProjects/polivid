import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoachProse } from "@/components/coach/coach-prose";
import { parseCoachMarkdown, type CoachBlock, type CoachInline } from "./coach-markdown";

const jobId = "0e12b67e-5c90-4892-985d-82ff56ecbe6c";

const script = [
  "Here's the brief with a shot-by-shot script. This mode has no spoken lines, so the script describes what happens on screen, not dialogue.",
  "",
  "**Script**",
  "- **0–3s:** Red alarms pulse in a collapsing corridor. Orel sprints toward camera and a tall black biomechanical alien lunges close behind him.",
  "- **3–6s:** Orel dives into the escape pod as the hatch slides shut.",
  "- **6–10s:** Orel slams the glowing launch lever. An alien claw scratches the porthole glass as the station breaks apart behind it.",
  "",
  'If you want Orel to speak, for example "Come on, come on…" in the pod, I\'d need to make this a staged production.',
].join("\n");

const plain = (nodes: CoachInline[]): string =>
  nodes
    .map((node) => {
      if (node.type === "text" || node.type === "code" || node.type === "link") return node.text;
      if (node.type === "image") return "";
      return plain(node.children);
    })
    .join("");

const blockText = (blocks: CoachBlock[]) =>
  blocks
    .map((block) => (block.type === "paragraph" ? plain(block.children) : block.items.map((item) => plain(item)).join("\n")))
    .join("\n");

test("a shot script becomes a bold label and a dash list", () => {
  const blocks = parseCoachMarkdown(script);

  assert.equal(blocks.length, 4);
  assert.deepEqual(blocks[1], {
    type: "paragraph",
    children: [{ type: "bold", children: [{ type: "text", text: "Script" }] }],
  });
  assert.equal(blocks[2]?.type, "list");
  if (blocks[2]?.type !== "list") return;
  assert.equal(blocks[2].ordered, false);
  assert.equal(blocks[2].items.length, 3);
  assert.deepEqual(blocks[2].items[0]?.[0], {
    type: "bold",
    children: [{ type: "text", text: "0–3s:" }],
  });
  assert.equal(plain(blocks[2].items[0] ?? []), "0–3s: Red alarms pulse in a collapsing corridor. Orel sprints toward camera and a tall black biomechanical alien lunges close behind him.");
  assert.match(blockText(blocks), /Otherwise, approve|staged production/);
  assert.equal(blockText(blocks).includes("**"), false);
});

test("italics, inline code, and ordered lists render, and snake case stays plain", () => {
  const blocks = parseCoachMarkdown("Say *quietly* and _once_, then use `**not bold**`.\n\n1. First beat\n2. Second beat\n\nsnake_case_stays");

  assert.deepEqual(blocks[0], {
    type: "paragraph",
    children: [
      { type: "text", text: "Say " },
      { type: "italic", children: [{ type: "text", text: "quietly" }] },
      { type: "text", text: " and " },
      { type: "italic", children: [{ type: "text", text: "once" }] },
      { type: "text", text: ", then use " },
      { type: "code", text: "**not bold**" },
      { type: "text", text: "." },
    ],
  });
  assert.deepEqual(blocks[1], {
    type: "list",
    ordered: true,
    items: [[{ type: "text", text: "First beat" }], [{ type: "text", text: "Second beat" }]],
  });
  assert.deepEqual(blocks[2], {
    type: "paragraph",
    children: [{ type: "text", text: "snake_case_stays" }],
  });
});

test("tags, markdown links, and unmatched markers stay text", () => {
  const blocks = parseCoachMarkdown(
    'See <script>alert(1)</script> and **<b>nope</b>** plus [click](javascript:alert(1)). A lone ** stays.',
  );
  const text = blockText(blocks);

  assert.match(text, /<script>alert\(1\)<\/script>/);
  assert.match(text, /<b>nope<\/b>/);
  assert.match(text, /\[click\]\(javascript:alert\(1\)\)/);
  assert.match(text, /A lone \*\* stays/);
  assert.equal(
    blocks.some((block) => block.type === "paragraph" && block.children.some((node) => node.type === "link")),
    false,
  );
});

test("a known job id still becomes a link, including inside bold", () => {
  const links = [{ id: jobId, href: `/videos/${jobId}` }];
  const blocks = parseCoachMarkdown(`The job is ${jobId}. **Open ${jobId}.**`, links);
  const paragraph = blocks[0];
  assert.equal(paragraph?.type, "paragraph");
  if (paragraph?.type !== "paragraph") return;

  assert.deepEqual(
    paragraph.children.find((node) => node.type === "link"),
    { type: "link", text: jobId, href: `/videos/${jobId}` },
  );
  const bold = paragraph.children.find((node) => node.type === "bold");
  assert.equal(bold?.type, "bold");
  if (bold?.type !== "bold") return;
  assert.deepEqual(
    bold.children.find((node) => node.type === "link"),
    { type: "link", text: jobId, href: `/videos/${jobId}` },
  );
});

test("the rendered script is styled text, and raw HTML is escaped", () => {
  const markup = renderToStaticMarkup(
    createElement(CoachProse, {
      text: `${script}\n\n<em>not italic</em> and \`code\``,
      links: [{ id: jobId, href: `/videos/${jobId}` }],
    }),
  );

  assert.match(markup, /<strong class="font-semibold">Script<\/strong>/);
  assert.match(markup, /<ul class="[^"]*list-disc[^"]*">/);
  assert.equal((markup.match(/<li>/g) ?? []).length, 3);
  assert.match(markup, /<strong class="font-semibold">0–3s:<\/strong> Red alarms/);
  assert.equal(markup.includes("**"), false);
  assert.equal(markup.includes("<script"), false);
  assert.equal(markup.includes("<em>not italic</em>"), false);
  assert.match(markup, /&lt;em&gt;not italic&lt;\/em&gt;/);
  assert.match(markup, /<code[^>]*>code<\/code>/);
  assert.equal(markup.includes("javascript:"), false);
});

test("a cited frame id renders as the picture", () => {
  const key = "uploads/user_abc/755bf394-1111-2222-3333-444444444444.jpg";
  const url = "/api/uploads/755bf394-1111-2222-3333-444444444444.jpg";
  const markup = renderToStaticMarkup(
    createElement(CoachProse, {
      text: "1. Frame 1 (new): Orel sprints. Image `755bf394...`.\n2. Frame 2 stays described.",
      pictures: [{ key, url }],
    }),
  );

  assert.match(markup, new RegExp(`src="${url}"`));
  assert.equal(markup.includes("<code"), false);
  assert.equal(markup.includes("Image"), false);
  assert.match(markup, /Frame 2 stays described/);
});

test("a known id in rendered prose is an anchor, not a raw uuid line", () => {
  const markup = renderToStaticMarkup(
    createElement(CoachProse, {
      text: `Ready: ${jobId}`,
      links: [{ id: jobId, href: `/videos/${jobId}` }],
    }),
  );

  assert.match(markup, new RegExp(`href="/videos/${jobId}"`));
  assert.match(markup, new RegExp(`>${jobId}</a>`));
});
