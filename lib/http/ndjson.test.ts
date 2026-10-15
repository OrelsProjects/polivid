import assert from "node:assert/strict";
import test from "node:test";
import { isNdjson, readNdjson } from "./ndjson";

test("readNdjson yields one object per line, including a leftover last line", async () => {
  const body = '{"n":1}\n{"n":2}\n{"n":3}';
  const response = new Response(body, { headers: { "Content-Type": "application/x-ndjson" } });
  const events: { n: number }[] = [];
  for await (const event of readNdjson<{ n: number }>(response)) events.push(event);
  assert.deepEqual(events, [{ n: 1 }, { n: 2 }, { n: 3 }]);
  assert.equal(isNdjson(response), true);
});
