import assert from "node:assert/strict";
import test from "node:test";
import { parseByteRange, rangedBytesResponse } from "./range";

test("parses closed and suffix byte ranges", () => {
  assert.deepEqual(parseByteRange("bytes=0-99", 500), { start: 0, end: 99 });
  assert.deepEqual(parseByteRange("bytes=100-", 500), { start: 100, end: 499 });
  assert.deepEqual(parseByteRange("bytes=-50", 500), { start: 450, end: 499 });
  assert.equal(parseByteRange(null, 500), null);
  assert.equal(parseByteRange("bytes=800-900", 500), "invalid");
});

test("answers a ranged request with 206", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const response = rangedBytesResponse(bytes, "video/mp4", "bytes=1-3");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 1-3/5");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([2, 3, 4]));
});
