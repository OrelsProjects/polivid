import assert from "node:assert/strict";
import test from "node:test";
import { mergeCharacterImage } from "./reference";

test("the character picture goes first, without duplicates, under the cap", () => {
  assert.deepEqual(mergeCharacterImage(["uploads/u/b.png", "uploads/u/c.png"], "uploads/u/a.png", 3), [
    "uploads/u/a.png",
    "uploads/u/b.png",
    "uploads/u/c.png",
  ]);
  assert.deepEqual(mergeCharacterImage(["uploads/u/a.png", "uploads/u/b.png"], "uploads/u/a.png", 3), [
    "uploads/u/a.png",
    "uploads/u/b.png",
  ]);
  assert.deepEqual(mergeCharacterImage(["uploads/u/b.png", "uploads/u/c.png", "uploads/u/d.png"], "uploads/u/a.png", 3), [
    "uploads/u/a.png",
    "uploads/u/b.png",
    "uploads/u/c.png",
  ]);
  assert.deepEqual(mergeCharacterImage(["uploads/u/b.png"], null, 3), ["uploads/u/b.png"]);
});
