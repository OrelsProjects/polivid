import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { parseByteRange, rangedBytesResponse, rangedFileResponse } from "./range";

test("parses closed and suffix byte ranges", () => {
  assert.deepEqual(parseByteRange("bytes=0-99", 500), { start: 0, end: 99 });
  assert.deepEqual(parseByteRange("bytes=100-", 500), { start: 100, end: 499 });
  assert.deepEqual(parseByteRange("bytes=-50", 500), { start: 450, end: 499 });
  assert.equal(parseByteRange(null, 500), null);
  assert.equal(parseByteRange("bytes=800-900", 500), "invalid");
});

test("canceling a file stream does not throw", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "range-"));
  const file = path.join(dir, "clip.mp4");
  await writeFile(file, Buffer.alloc(256 * 1024, 7));
  const errors: unknown[] = [];
  const handleError = (error: unknown) => {
    errors.push(error);
  };
  process.on("uncaughtException", handleError);
  try {
    const response = await rangedFileResponse(file, "video/mp4", "bytes=0-1023");
    assert.equal(response.status, 206);
    const reader = response.body?.getReader();
    assert.ok(reader);
    await reader.read();
    await reader.cancel();
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(errors.length, 0);
  } finally {
    process.off("uncaughtException", handleError);
    await rm(dir, { recursive: true, force: true });
  }
});

test("answers a ranged request with 206", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const response = rangedBytesResponse(bytes, "video/mp4", "bytes=1-3");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("Content-Range"), "bytes 1-3/5");
  assert.equal(response.headers.get("Accept-Ranges"), "bytes");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([2, 3, 4]));
});
