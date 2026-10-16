import assert from "node:assert/strict";
import test from "node:test";
import { tool, validateUIMessages, type UIMessage } from "ai";
import { z } from "zod";
import { sanitizeCoachMessages } from "./sanitize-messages";

const tools = {
  create_video: tool({
    inputSchema: z.object({
      prompt: z.string().min(3),
    }),
  }),
};

const approvedWithSkippedOutput = {
  id: "assistant-1",
  role: "assistant" as const,
  parts: [
    { type: "step-start" as const },
    { type: "text" as const, text: "Queuing it.", state: "done" as const },
    {
      type: "tool-create_video" as const,
      toolCallId: "toolu_01",
      state: "approval-responded" as const,
      input: { prompt: "Coffee's cold, it's two a.m." },
      output: { skipped: true },
      approval: { id: "aitxt-1", approved: true },
    },
  ],
} as UIMessage;

test("an approved tool call with a skipped output fails validation", async () => {
  await assert.rejects(() => validateUIMessages({ messages: [approvedWithSkippedOutput], tools }));
});

test("sanitizeCoachMessages drops output that approval states cannot carry", async () => {
  const [message] = sanitizeCoachMessages([approvedWithSkippedOutput]);
  const part = message?.parts[2];
  assert.ok(part);
  assert.equal("output" in part, false);
  assert.equal(part.type === "tool-create_video" ? part.state : "", "approval-responded");

  const validated = await validateUIMessages({ messages: [message], tools });
  assert.equal(validated[0]?.parts[2]?.type, "tool-create_video");
});

test("sanitizeCoachMessages keeps a finished tool result", () => {
  const finished = {
    id: "assistant-2",
    role: "assistant" as const,
    parts: [
      {
        type: "tool-create_video" as const,
        toolCallId: "toolu_02",
        state: "output-available" as const,
        input: { prompt: "Coffee's cold, it's two a.m." },
        output: { jobId: "job-1" },
        approval: { id: "aitxt-2", approved: true as const },
      },
    ],
  } as UIMessage;

  const [message] = sanitizeCoachMessages([finished]);
  const part = message?.parts[0];
  assert.equal(part && "output" in part ? (part.output as { jobId?: string }).jobId : "", "job-1");
});
