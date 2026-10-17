import assert from "node:assert/strict";
import test from "node:test";
import { toolResultView } from "./result";

test("a saved picture is an image, not an open link", () => {
  const view = toolResultView({
    imageKey: "uploads/user/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png",
    url: "/api/uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png",
    prompt: "A woman in a red coat",
  });
  assert.equal(view.imageUrl, "/api/uploads/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png");
  assert.equal(view.imageKey, "uploads/user/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.png");
  assert.equal(view.href, undefined);
  assert.equal(view.linkLabel, undefined);
  assert.equal(view.tone, "done");
});

test("a song stays a play link", () => {
  const view = toolResultView({ songId: "song_1", url: "/api/songs/song_1" });
  assert.equal(view.href, "/api/songs/song_1");
  assert.equal(view.linkLabel, "Play song");
  assert.equal(view.imageUrl, undefined);
});

test("a picture error stays an error", () => {
  const view = toolResultView({ error: "Couldn't make that picture.", url: "/api/uploads/nope.png" });
  assert.equal(view.tone, "error");
  assert.equal(view.state, "Couldn't make that picture.");
  assert.equal(view.imageUrl, undefined);
});
