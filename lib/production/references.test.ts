import assert from "node:assert/strict";
import test from "node:test";
import { ownedReferenceKeys, referenceAttachments, referencePictures, referencePrompt } from "./references";

const mine = "uploads/user_1/0f2a9c1e-6c4a-4a1b-9c3e-2b7d8e9f0a11.png";
const theirs = "uploads/user_2/0f2a9c1e-6c4a-4a1b-9c3e-2b7d8e9f0a12.png";
const song = "uploads/user_1/0f2a9c1e-6c4a-4a1b-9c3e-2b7d8e9f0a13.mp3";

test("only the user's own pictures become references", () => {
  assert.deepEqual(ownedReferenceKeys("user_1", [mine, theirs, song, mine, "../etc/passwd"]), [mine]);
});

test("reference pictures are stored as image attachments with their storage key", () => {
  const attachments = referenceAttachments([mine]);
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0]!.kind, "image");
  assert.equal(attachments[0]!.mime, "image/png");
  assert.equal(attachments[0]!.key, mine);
  assert.deepEqual(
    referencePictures({ text: "x", attachments: [...attachments, { id: "doc", name: "notes", mime: "text/plain", kind: "document", text: "…" }], classification: null }).map((a) => a.key),
    [mine],
  );
  assert.deepEqual(referencePictures(null), []);
});

test("still prompts mention the references only when there are some", () => {
  assert.equal(referencePrompt("A kitchen.", 0), "A kitchen.");
  assert.match(referencePrompt("A kitchen.", 1), /reference picture\./);
  assert.match(referencePrompt("A kitchen.", 3), /reference pictures\./);
});
