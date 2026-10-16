import "server-only";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type UIMessage,
} from "ai";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";
import { coachInstructions } from "./instructions";
import { mergeCoachTurn } from "./merge-turn";
import { referenceKeysFromMessages } from "./reference-notes";
import { sanitizeCoachMessages } from "./sanitize-messages";
import { voiceFromMessages } from "./voice-notes";
import { loadCoachMessages, saveCoachMessages } from "./store";
import { buildCoachTools } from "./tools";

export const COACH_MODEL = process.env.POLIVID_COACH_MODEL || "anthropic/claude-sonnet-5.5";

export const runCoachTurn = async (input: {
  userId: string;
  threadId: string;
  message: UIMessage;
  timezone?: string;
}) => {
  if (!hasOpenRouterKey()) {
    throw new Error("Add an API key to talk to the Coach.");
  }
  const previous = await loadCoachMessages(input.userId, input.threadId);
  const messages = sanitizeCoachMessages(mergeCoachTurn(previous, input.message));
  const tools = buildCoachTools(input.userId, referenceKeysFromMessages(messages), voiceFromMessages(messages));
  const validated = await validateUIMessages({ messages, tools });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: input.timezone || "UTC",
    dateStyle: "full",
  }).format(new Date());

  const result = streamText({
    model: openrouter().chat(COACH_MODEL),
    system: coachInstructions({ today, timezone: input.timezone || "UTC" }),
    messages: await convertToModelMessages(validated),
    tools,
    toolApproval: {
      create_video: "user-approval",
      start_production: "user-approval",
    },
    ...(process.env.TOOL_APPROVAL_SECRET
      ? { experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET }
      : {}),
    stopWhen: isStepCount(6),
  });

  result.consumeStream({
    onError: (error) => {
      console.error("Coach turn failed", error);
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: validated,
      generateMessageId: () => crypto.randomUUID(),
      onEnd: ({ messages: next }) => {
        void saveCoachMessages(input.userId, input.threadId, next);
      },
    }),
  });
};
