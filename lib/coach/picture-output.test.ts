import assert from "node:assert/strict";
import test from "node:test";
import { replacePictureOutput, savedPicture, storedPictureCall } from "./picture-output";

const source = "uploads/user_abc/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg";
const picture = {
  imageKey: "uploads/user_abc/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee.png",
  url: "/api/uploads/bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee.png",
  prompt: "Big smile",
};

const parts = [
  { type: "text", text: "Done." },
  {
    type: "tool-edit_image",
    toolCallId: "call-1",
    state: "output-available",
    input: { prompt: "Big smile", sourceKey: source },
    output: picture,
  },
];

test("a saved picture needs an upload url and key", () => {
  assert.deepEqual(savedPicture(picture), picture);
  assert.equal(savedPicture({ error: "Couldn't make that picture.", ...picture }), null);
  assert.equal(savedPicture({ imageKey: picture.imageKey, url: "/api/songs/song_1" }), null);
});

test("the stored call is the finished picture tool", () => {
  assert.deepEqual(storedPictureCall(parts, "call-1"), {
    tool: "edit_image",
    input: { prompt: "Big smile", sourceKey: source },
  });
  assert.equal(storedPictureCall(parts, "missing"), null);
  assert.equal(storedPictureCall([{ type: "tool-compose_song", toolCallId: "call-1", state: "output-available" }], "call-1"), null);
});

test("replacing a picture output leaves the rest of the message", () => {
  const next = {
    imageKey: "uploads/user_abc/cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee.png",
    url: "/api/uploads/cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee.png",
    prompt: "Big smile",
  };
  const replaced = replacePictureOutput(parts, "call-1", next);
  assert.ok(replaced);
  assert.equal((replaced[0] as { text: string }).text, "Done.");
  assert.deepEqual((replaced[1] as { output: unknown }).output, next);
  assert.equal(replacePictureOutput(parts, "missing", next), null);
});
