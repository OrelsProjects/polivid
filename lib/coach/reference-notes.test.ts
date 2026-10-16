import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeReferenceKeys,
  proseWithoutReferenceNote,
  referenceKeysFromMessages,
  referenceKeysFromNote,
  referencePictureNote,
} from "./reference-notes";

const key = "uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg";

test("reference notes round-trip picture keys", () => {
  const note = referencePictureNote([key, key, "not-a-picture"]);
  assert.equal(note, `Attached reference pictures: ${key}`);
  assert.deepEqual(referenceKeysFromNote(note), [key]);
  assert.equal(proseWithoutReferenceNote(`Use this singer.\n${note}`), "Use this singer.");
});

test("reference keys collect across user messages", () => {
  const keys = referenceKeysFromMessages([
    { role: "user", parts: [{ type: "text", text: "A lyrics video" }] },
    { role: "assistant", parts: [{ type: "text", text: referencePictureNote([key]) }] },
    { role: "user", parts: [{ type: "text", text: referencePictureNote([key]) }] },
  ]);
  assert.deepEqual(keys, [key]);
  assert.deepEqual(mergeReferenceKeys([key], undefined, ["uploads/nope.txt"]), [key]);
});
