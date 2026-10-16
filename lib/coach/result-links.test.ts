import assert from "node:assert/strict";
import test from "node:test";
import { linkKnownIds, resultLinksFromParts } from "./result-links";

const jobId = "0e12b67e-5c90-4892-985d-82ff56ecbe6c";

test("resultLinksFromParts links a queued video and a started production", () => {
  const links = resultLinksFromParts([
    { type: "tool-create_video", state: "output-available", output: { jobId, credits: 1170 } },
    { type: "tool-start_production", state: "output-available", output: { productionId: "prod-1" } },
    { type: "tool-create_video", state: "output-available", output: { error: "Not enough credits." } },
    { type: "tool-create_video", state: "approval-requested", output: { jobId: "ignored" } },
  ]);

  assert.deepEqual(links, [
    { id: jobId, href: `/videos/${jobId}`, label: "Open video" },
    { id: "prod-1", href: "/productions/prod-1", label: "Open production" },
  ]);
});

test("linkKnownIds turns the job id in coach prose into a video link", () => {
  const pieces = linkKnownIds(`The job ID is \`${jobId}\`. You can follow it in your videos list.`, [
    { id: jobId, href: `/videos/${jobId}` },
  ]);

  assert.deepEqual(pieces, [
    { kind: "text", text: "The job ID is `" },
    { kind: "link", text: jobId, href: `/videos/${jobId}` },
    { kind: "text", text: "`. You can follow it in your videos list." },
  ]);
});

test("linkKnownIds leaves unrelated ids as text", () => {
  const pieces = linkKnownIds("Job 11111111-1111-1111-1111-111111111111 is someone else's.", [
    { id: jobId, href: `/videos/${jobId}` },
  ]);

  assert.deepEqual(pieces, [{ kind: "text", text: "Job 11111111-1111-1111-1111-111111111111 is someone else's." }]);
});
