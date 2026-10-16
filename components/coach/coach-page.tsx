"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { BRIEF_APPROVAL_TEXT, hasApprovableBrief } from "@/lib/coach/brief-blocks";
import { apiErrorMessage } from "@/lib/store/api-errors";
import { useCreateCoachThreadMutation, useGetCoachThreadsQuery } from "@/lib/store/endpoints/coach";
import { isCoachClientTool } from "@/lib/coach/client-tools";
import type { BriefApproval } from "@/components/coach/coach-brief-card";
import { mergeReferenceKeys, referenceKeysFromMessages, referencePictureNote } from "@/lib/coach/reference-notes";
import { voiceNote } from "@/lib/coach/voice-notes";
import { OFF_VOICE_ID } from "@/lib/voice/constants";
import { useCharacters } from "@/components/characters/use-characters";
import { CoachComposer } from "@/components/coach/coach-composer";
import { CoachEmptyState } from "@/components/coach/coach-empty-state";
import { CoachMessage } from "@/components/coach/coach-message";
import { CoachThreadList, type CoachThreadItem } from "@/components/coach/coach-thread-list";

const NO_THREADS: CoachThreadItem[] = [];
import { useCoachClientTools } from "@/components/coach/use-coach-client-tools";

export function CoachPage({
  initialThreadId,
  initialMessages = [],
}: {
  initialThreadId?: string;
  initialMessages?: UIMessage[];
}) {
  const { data: threads = NO_THREADS } = useGetCoachThreadsQuery();
  const [createThread] = useCreateCoachThreadMutation();
  const [threadId, setThreadId] = useState(initialThreadId);
  const [input, setInput] = useState("");
  const [referenceKeys, setReferenceKeys] = useState<string[]>([]);
  const [referencesBusy, setReferencesBusy] = useState(false);
  const [characterId, setCharacterId] = useState(OFF_VOICE_ID);
  const [characterName, setCharacterName] = useState("");
  const characters = useCharacters();
  const threadIdRef = useRef(initialThreadId);
  const referenceKeysRef = useRef<string[]>([]);
  const sentReferenceKeysRef = useRef<string[]>([]);
  const voiceRef = useRef(OFF_VOICE_ID);
  const briefApprovedRef = useRef(false);
  const [approvedBriefId, setApprovedBriefId] = useState<string | null>(null);
  const clientTools = useCoachClientTools(referenceKeysRef, voiceRef);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/coach/threads/_/messages",
        prepareSendMessagesRequest({ messages }) {
          const id = threadIdRef.current;
          if (!id) throw new Error("Start a chat first.");
          return {
            api: `/api/coach/threads/${id}/messages`,
            body: {
              message: messages[messages.length - 1],
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, addToolOutput, addToolApprovalResponse, status, error } = useChat({
    id: initialThreadId ?? "new-coach",
    messages: initialMessages,
    transport,
    sendAutomaticallyWhen: (options) =>
      lastAssistantMessageIsCompleteWithToolCalls(options) ||
      lastAssistantMessageIsCompleteWithApprovalResponses(options),
    async onToolCall({ toolCall }) {
      if (toolCall.dynamic || !isCoachClientTool(toolCall.toolName)) return;
      const output = clientTools.run(toolCall.toolName, (toolCall.input ?? {}) as Record<string, unknown>);
      addToolOutput({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output,
      });
    },
  });

  referenceKeysRef.current = mergeReferenceKeys(
    referenceKeysFromMessages(messages),
    referenceKeys,
    sentReferenceKeysRef.current,
  );
  voiceRef.current = characterId;

  useEffect(() => {
    if (!briefApprovedRef.current) return;
    const last = messages.at(-1);
    if (last?.role !== "assistant") return;
    for (const part of last.parts) {
      if (part.type !== "tool-create_video" && part.type !== "tool-start_production") continue;
      if (part.state !== "approval-requested" || !("approval" in part) || !part.approval?.id) continue;
      if (part.approval.isAutomatic) continue;
      briefApprovedRef.current = false;
      addToolApprovalResponse({ id: part.approval.id, approved: true });
      return;
    }
  }, [messages, addToolApprovalResponse]);

  const ensureThread = async () => {
    if (threadIdRef.current) return threadIdRef.current;
    const thread = await createThread()
      .unwrap()
      .catch((cause: unknown) => {
        throw new Error(apiErrorMessage(cause, "Couldn't start a chat."));
      });
    threadIdRef.current = thread.id;
    setThreadId(thread.id);
    window.history.replaceState(null, "", `/coach/${thread.id}`);
    return thread.id;
  };

  const handleSend = async (text = input) => {
    const value = text.trim();
    const pictures = referenceKeys;
    if ((!value && pictures.length === 0) || referencesBusy || status === "submitted" || status === "streaming") return;
    const spoken = value || "Use these reference pictures.";
    sentReferenceKeysRef.current = mergeReferenceKeys(sentReferenceKeysRef.current, pictures);
    referenceKeysRef.current = mergeReferenceKeys(referenceKeysFromMessages(messages), pictures, sentReferenceKeysRef.current);
    await ensureThread();
    voiceRef.current = characterId;
    briefApprovedRef.current = false;
    setApprovedBriefId(null);
    const parts = [
      { type: "text" as const, text: spoken },
      ...(pictures.length > 0 ? [{ type: "text" as const, text: referencePictureNote(pictures) }] : []),
      { type: "text" as const, text: voiceNote(characterId, characterName) },
    ];
    sendMessage({ role: "user", parts });
    setInput("");
    setReferenceKeys([]);
  };

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const approvableBriefId =
    !busy && !referencesBusy && lastMessage && hasApprovableBrief(lastMessage) ? lastMessage.id : null;

  const handleApproveBrief = async (messageId: string) => {
    if (busy || approvedBriefId) return;
    await ensureThread();
    voiceRef.current = characterId;
    briefApprovedRef.current = true;
    setApprovedBriefId(messageId);
    sendMessage({
      role: "user",
      parts: [
        { type: "text", text: BRIEF_APPROVAL_TEXT },
        { type: "text", text: voiceNote(characterId, characterName) },
      ],
    });
  };

  const briefApprovalFor = (messageId: string): BriefApproval | undefined => {
    if (messageId === approvedBriefId) return "sent";
    if (messageId === approvableBriefId) return "ready";
    return undefined;
  };

  return (
    <div className="flex min-h-[calc(100svh-4rem)] flex-col md:h-[calc(100svh)] md:flex-row">
      <CoachThreadList
        threads={threads}
        activeId={threadId}
        onSelect={(id) => {
          window.location.assign(`/coach/${id}`);
        }}
        onCreate={() => {
          window.location.assign("/coach");
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <CoachEmptyState onPick={(text) => void handleSend(text)} />
          ) : (
            messages.map((message) => (
              <CoachMessage
                key={message.id}
                message={message}
                hasReferencePictures={referenceKeysRef.current.length > 0}
                hasVoice={characterId !== OFF_VOICE_ID}
                characters={characters}
                briefApproval={briefApprovalFor(message.id)}
                onApproveBrief={() => void handleApproveBrief(message.id)}
                onApprove={(id) => addToolApprovalResponse({ id, approved: true })}
                onDeny={(id) => addToolApprovalResponse({ id, approved: false })}
                onAnswer={(toolCallId, answer) =>
                  addToolOutput({
                    tool: "app_ask_question",
                    toolCallId,
                    output: answer,
                  })
                }
              />
            ))
          )}
          {busy && <p className="text-xs text-muted-foreground">Thinking…</p>}
          {error && <p className="text-sm text-red-700">{error.message}</p>}
        </div>
        <CoachComposer
          value={input}
          onChange={setInput}
          onSend={() => void handleSend()}
          disabled={busy || referencesBusy}
          referenceKeys={referenceKeys}
          onReferenceKeys={setReferenceKeys}
          onReferencesBusy={setReferencesBusy}
          characterId={characterId}
          onCharacterId={setCharacterId}
          onCharacterName={setCharacterName}
          characters={characters}
        />
      </div>
    </div>
  );
}
