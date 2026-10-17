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
import { activeToolNamesFor } from "@/lib/tools/registry";
import { coachInstructions } from "./instructions";
import { coachToolApproval } from "./tool-approval";
import { mergeCoachTurn } from "./merge-turn";
import { attachedMediaFromMessages, referenceKeysFromMessages } from "./reference-notes";
import { sanitizeCoachMessages } from "./sanitize-messages";
import { voiceFromMessages } from "./voice-notes";
import { getCoachThread, loadCoachMessages, saveCoachMessages } from "./store";
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
  const thread = await getCoachThread(input.userId, input.threadId);
  const previous = thread
    ? thread.messages.map((message) => ({
        id: message.id,
        role: message.role as UIMessage["role"],
        parts: message.parts as UIMessage["parts"],
      }))
    : await loadCoachMessages(input.userId, input.threadId);
  const messages = sanitizeCoachMessages(mergeCoachTurn(previous, input.message));
  const attachedCharacterId = voiceFromMessages(messages);
  const tools = buildCoachTools({
    userId: input.userId,
    threadId: input.threadId,
    projectId: thread?.editProjectId ?? undefined,
    attachedReferenceKeys: referenceKeysFromMessages(messages),
    attachedCharacterId,
    attachedMedia: attachedMediaFromMessages(messages),
    timezone: input.timezone || "UTC",
  });
  const validated = await validateUIMessages({ messages, tools });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: input.timezone || "UTC",
    dateStyle: "full",
  }).format(new Date());

  const result = streamText({
    model: openrouter().chat(COACH_MODEL),
    system: coachInstructions({
      today,
      timezone: input.timezone || "UTC",
      projectId: thread?.editProjectId,
    }),
    messages: await convertToModelMessages(validated),
    tools,
    activeTools: activeToolNamesFor(validated),
    toolApproval: async ({ toolCall }) => {
      if (toolCall.dynamic) return "user-approval" as const;
      return coachToolApproval({
        userId: input.userId,
        toolName: toolCall.toolName,
        toolInput: toolCall.input,
        attachedCharacterId,
      });
    },
    ...(process.env.TOOL_APPROVAL_SECRET
      ? { experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET }
      : {}),
    stopWhen: isStepCount(10),
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
