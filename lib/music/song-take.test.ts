import assert from "node:assert/strict";
import test from "node:test";
import { mergeSongTakes, songTakeNumber } from "./song-take";

const take = (id: string, createdAt: string) => ({ id, createdAt });

test("keeps the old takes when a new one is made", () => {
  const first = take("aaaaaaaa-0000-0000-0000-000000000001", "2026-10-17T06:00:00.000Z");
  const second = take("aaaaaaaa-0000-0000-0000-000000000002", "2026-10-17T06:05:00.000Z");
  assert.deepEqual(mergeSongTakes([first], [second]), [first, second]);
});

test("merging the same take twice keeps one copy, and the incoming copy wins", () => {
  const made: { id: string; createdAt: string; voiceName: string | null } = {
    ...take("aaaaaaaa-0000-0000-0000-000000000001", "2026-10-17T06:00:00.000Z"),
    voiceName: null,
  };
  const restored = { ...made, voiceName: "Orel" };
  assert.deepEqual(mergeSongTakes([made], [restored]), [restored]);
});

test("restored takes slot into the history oldest first, whatever order they arrive in", () => {
  const first = take("aaaaaaaa-0000-0000-0000-000000000001", "2026-10-17T06:00:00.000Z");
  const second = take("aaaaaaaa-0000-0000-0000-000000000002", "2026-10-17T06:05:00.000Z");
  const third = take("aaaaaaaa-0000-0000-0000-000000000003", "2026-10-17T06:10:00.000Z");
  const merged = mergeSongTakes([third], [second, first]);
  assert.deepEqual(merged, [first, second, third]);
  assert.equal(songTakeNumber(merged, first.id), 1);
  assert.equal(songTakeNumber(merged, third.id), 3);
  assert.equal(songTakeNumber(merged, "missing"), 0);
});
