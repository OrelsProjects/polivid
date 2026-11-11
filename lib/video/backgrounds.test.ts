import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { BACKGROUND_IDS, BACKGROUND_LOOPS, DEFAULT_BACKGROUND_ID, backgroundById } from "./backgrounds";

test("every built-in loop ships with its clip and its poster", () => {
  const ids = new Set<string>();
  for (const loop of BACKGROUND_LOOPS) {
    assert.equal(ids.has(loop.id), false, loop.id);
    ids.add(loop.id);
    assert.ok(loop.seconds > 1, loop.id);
    for (const file of [loop.file, loop.poster]) {
      const onDisk = path.join(process.cwd(), "public", file);
      assert.ok(existsSync(onDisk), `${file} is missing`);
      assert.ok(statSync(onDisk).size > 500, `${file} is empty`);
    }
    // A background must stay small: it is downloaded by the renderer for every video.
    assert.ok(statSync(path.join(process.cwd(), "public", loop.file)).size < 2_000_000, loop.id);
  }
});

test("the default background exists, and an unknown id finds nothing", () => {
  assert.ok(backgroundById(DEFAULT_BACKGROUND_ID));
  assert.equal(backgroundById("nope"), null);
  assert.equal(backgroundById(undefined), null);
});

test("the ids the Coach may pass are exactly the built-in loops", () => {
  assert.deepEqual([...BACKGROUND_IDS].sort(), BACKGROUND_LOOPS.map((loop) => loop.id).sort());
});
