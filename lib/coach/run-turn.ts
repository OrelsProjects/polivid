import "server-only";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  hasToolCall,
  isStepCount,
  streamText,
  toUIMessageStream,
  validateUIMessages,
  type UIMessage,
} from "ai";
import { hasOpenRouterKey, openrouter } from "@/lib/ai/openrouter";
import { db } from "@/lib/db";
import { activeToolNamesFor } from "@/lib/tools/registry";
import { isBriefApprovalMessage } from "./brief-blocks";
import { clipsFromMessage } from "./brief-edit-notes";
import { modelFromMessage } from "./model-notes";
import { isFilmingStatus } from "./filming-guard";
import { coachInstructions } from "./instructions";
import { presetConfirmationPending, withoutHeldImageTools } from "./preset-confirm";
import { videoJobIdFromMessages } from "./linked-job";
import { runWildFromMessages } from "./run-wild-notes";
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
  const pendingUser = [...messages].reverse().find((message) => message.role === "user");
  const generationModelId = pendingUser ? modelFromMessage(pendingUser) : "";
  const clipCount = pendingUser ? clipsFromMessage(pendingUser) : undefined;
  const jobId = videoJobIdFromMessages(messages) ?? thread?.videoJobId ?? null;
  const job = jobId
    ? await db.videoJob.findFirst({ where: { id: jobId, userId: input.userId }, select: { status: true } })
    : null;
  const filming = isFilmingStatus(job?.status);
  const runWild = runWildFromMessages(messages);
  const tools = buildCoachTools({
    userId: input.userId,
    threadId: input.threadId,
    projectId: thread?.editProjectId ?? undefined,
    attachedReferenceKeys: referenceKeysFromMessages(messages),
    attachedCharacterId,
    attachedMedia: attachedMediaFromMessages(messages),
    generationModelId,
    clipCount,
    timezone: input.timezone || "UTC",
    filming,
    runWild,
  });
  const validated = await validateUIMessages({ messages, tools });
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: input.timezone || "UTC",
    dateStyle: "full",
  }).format(new Date());

  const lastUser = [...validated].reverse().find((message) => message.role === "user");
  const briefApproved = lastUser ? isBriefApprovalMessage(lastUser) : false;
  const offeredTools = activeToolNamesFor(validated);
  const activeTools =
    runWild || !presetConfirmationPending(validated) ? offeredTools : withoutHeldImageTools(offeredTools);

  const result = streamText({
    model: openrouter().chat(COACH_MODEL),
    system: coachInstructions({
      today,
      timezone: input.timezone || "UTC",
      projectId: thread?.editProjectId,
      filming,
    }),
    messages: await convertToModelMessages(validated),
    tools,
    activeTools,
    toolApproval: async ({ toolCall }) => {
      if (toolCall.dynamic) return "user-approval" as const;
      return coachToolApproval({
        userId: input.userId,
        toolName: toolCall.toolName,
        toolInput: toolCall.input,
        attachedCharacterId,
        runWild,
        briefApproved,
        generationModelId,
      });
    },
    ...(process.env.TOOL_APPROVAL_SECRET
      ? { experimental_toolApprovalSecret: process.env.TOOL_APPROVAL_SECRET }
      : {}),
    stopWhen: [isStepCount(10), hasToolCall("suggest_preset")],
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
