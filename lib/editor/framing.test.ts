import assert from "node:assert/strict";
import test from "node:test";
import { coverFrame } from "./framing";
import type { Transform } from "./schema";

const transform = (patch: Partial<Transform>): Transform => ({
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  fit: "cover",
  ...patch,
});

test("coverFrame never shrinks a clip below the frame", () => {
  assert.deepEqual(coverFrame(transform({ scale: 0.83, x: 0.288, y: -0.5 })), transform({}));
});

test("coverFrame keeps zoom and clamps panning to the zoomed overflow", () => {
  assert.deepEqual(coverFrame(transform({ scale: 1.5, x: 40, y: -10 })), transform({ scale: 1.5, x: 25, y: -10 }));
});

test("coverFrame keeps rotation", () => {
  assert.equal(coverFrame(transform({ rotation: 12 })).rotation, 12);
});
