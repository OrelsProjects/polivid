import assert from "node:assert/strict";
import test from "node:test";
import { pictureForMention, picturesFromMessage, type CoachPictureRef } from "./picture-mentions";

const key = "uploads/user_abc/755bf394-1111-2222-3333-444444444444.jpg";
const other = "uploads/user_abc/0887203d-1111-2222-3333-444444444444.png";

const pictures: CoachPictureRef[] = [
  { key, url: "/api/uploads/755bf394-1111-2222-3333-444444444444.jpg" },
  { key: other, url: "/api/uploads/0887203d-1111-2222-3333-444444444444.png" },
];

test("a cited frame id resolves to the picture we already made", () => {
  assert.equal(pictureForMention(`\`${key}\``, pictures)?.url, pictures[0]?.url);
  assert.equal(pictureForMention("755bf394-1111-2222-3333-444444444444.jpg", pictures)?.key, key);
  assert.equal(pictureForMention("755bf394...", pictures)?.key, key);
  assert.equal(pictureForMention("755bf394…", pictures)?.key, key);
  assert.equal(pictureForMention("nope", pictures), null);
  assert.equal(pictureForMention("755bf394", [pictures[0]!, pictures[1]!, { key: "uploads/user_abc/755bf394-aaaa-bbbb-cccc-dddddddddddd.jpg", url: "/x" }]), null);
});

test("storyboard output and a brief keep their frame pictures", () => {
  const found = picturesFromMessage({
    parts: [
      {
        type: "tool-make_storyboard",
        state: "output-available",
        output: { frames: [{ imageKey: key, url: "/api/uploads/755bf394-1111-2222-3333-444444444444.jpg" }] },
      },
      {
        type: "text",
        text: ["```brief", "frames: " + other, "```"].join("\n"),
      },
    ],
  });
  assert.deepEqual(found.map((picture) => picture.key).sort(), [key, other].sort());
});
