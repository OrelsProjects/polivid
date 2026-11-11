"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import { ArrowDown, ArrowLeft, CircleAlert, X } from "lucide-react";
import Link from "next/link";
import { LayoutGroup, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BRIEF_APPROVAL_TEXT,
  briefFromParts,
  briefNeedsApproval,
  hasApprovableBrief,
  isBriefApprovalMessage,
} from "@/lib/coach/brief-blocks";
import { confirmedLookForMessage, confirmedLookMessage, isLookConfirmationMessage } from "@/lib/coach/preset-confirm";
import { apiErrorMessage } from "@/lib/store/api-errors";
import {
  useCreateCoachThreadMutation,
  useEnsureCoachProjectMutation,
  useGetCoachThreadsQuery,
  useRetryCoachPictureMutation,
  useRetryStoryboardFrameMutation,
} from "@/lib/store/endpoints/coach";
import { useGetPresetsQuery } from "@/lib/store/endpoints/presets";
import { useGetVideoJobQuery } from "@/lib/store/endpoints/videos";
import { uploadsApi, type LibraryUpload } from "@/lib/store/endpoints/uploads";
import { useAppDispatch } from "@/lib/store/hooks";
import { isCoachClientTool } from "@/lib/coach/client-tools";
import { toolByName } from "@/lib/tools/registry";
import type { BriefApproval } from "@/components/coach/coach-brief-card";
import {
  attachedFileNote,
  attachedMediaFromMessages,
  mergeReferenceKeys,
  referenceKeysFromMessages,
  referencePictureNote,
} from "@/lib/coach/reference-notes";
import { runWildNote } from "@/lib/coach/run-wild-notes";
import { voiceNote } from "@/lib/coach/voice-notes";
import { OFF_VOICE_ID } from "@/lib/voice/constants";
import { useCharacters } from "@/components/characters/use-characters";
import { LogoMark } from "@/components/logo";
import { CoachComposer } from "@/components/coach/coach-composer";
import { CoachEmptyState } from "@/components/coach/coach-empty-state";
import { CoachMessage } from "@/components/coach/coach-message";
import { picturesFromMessages } from "@/lib/coach/picture-mentions";
import { briefEditNote, type BriefEdits } from "@/lib/coach/brief-edit-notes";
import { modelFromMessage, modelNote } from "@/lib/coach/model-notes";
import { revisedAnswerMessage } from "@/lib/coach/revised-answer";
import type { PictureLibraryState } from "@/components/coach/coach-picture";
import { CoachThreadList, type CoachThreadItem } from "@/components/coach/coach-thread-list";
import { useMotionSafe } from "@/components/motion/motion";
import { useCoachClientTools } from "@/components/coach/use-coach-client-tools";
import { CoachProjectView } from "@/components/coach/project/coach-project-view";
import { videoJobIdFromMessages } from "@/lib/coach/linked-job";
import { isCoachProjectMode, visibleCoachProject } from "@/lib/coach/project-surface";
import { showCoachThreadInAddressBar } from "@/lib/coach/thread-url";
import type { EditProjectView } from "@/lib/editor/types";
import type { VideoJobView } from "@/lib/video/job-status";
import { GENERATION_MODEL_IDS, type GenerationModelId } from "@/lib/video/models";

const NO_THREADS: CoachThreadItem[] = [];
const runWildKey = (id: string) => `polivid.coach.runWild.${id}`;
/** How close to the bottom still counts as following the conversation. */
const STICK_PX = 96;

/** The open chat. The address bar can still say /coach when the first message is sent. */
let coachRequestThreadId: string | null = null;

/** Setup the next request waits on: a pending edit save and, in a new chat, the thread itself. */
let coachRequestReady: Promise<unknown> | null = null;

const threadIdFromLocation = () => window.location.pathname.match(/^\/coach\/([^/]+)/)?.[1] ?? null;

/** The thread id lives in the URL: a new chat replaces it with /coach/{id} before the first send. */
const transport = new DefaultChatTransport({
  api: "/api/coach/threads/_/messages",
  prepareSendMessagesRequest: async ({ messages }) => {
    const ready = coachRequestReady;
    coachRequestReady = null;
    if (ready) await ready;
    const id = coachRequestThreadId ?? threadIdFromLocation();
    if (!id) throw new Error("Start a chat first.");
    return {
      api: `/api/coach/threads/${id}/messages`,
      body: {
        message: messages[messages.length - 1],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  },
});

export function CoachPage({
  initialThreadId,
  initialMessages = [],
  initialJob = null,
  initialProject = null,
  models = [...GENERATION_MODEL_IDS],
}: {
  initialThreadId?: string;
  initialMessages?: UIMessage[];
  initialJob?: VideoJobView | null;
  initialProject?: EditProjectView | null;
  /** Footage models this server can film with. */
  models?: GenerationModelId[];
}) {
  const { data: threads = NO_THREADS } = useGetCoachThreadsQuery();
  const { data: customPresets = [] } = useGetPresetsQuery();
  const [createThread] = useCreateCoachThreadMutation();
  const [threadId, setThreadId] = useState(initialThreadId);
  const [input, setInput] = useState("");
  const [referenceKeys, setReferenceKeys] = useState<string[]>([]);
  const [mediaKey, setMediaKey] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const [referencesBusy, setReferencesBusy] = useState(false);
  const [characterId, setCharacterId] = useState(OFF_VOICE_ID);
  const [characterName, setCharacterName] = useState("");
  const [runWild, setRunWild] = useState(false);
  const runWildRef = useRef(false);
  const characters = useCharacters();
  const threadIdRef = useRef(initialThreadId);
  coachRequestThreadId = threadIdRef.current ?? null;
  const referenceKeysRef = useRef<string[]>([]);
  const sentReferenceKeysRef = useRef<string[]>([]);
  const mediaKeyRef = useRef<string | null>(null);
  const sentMediaKeyRef = useRef<string | null>(null);
  const videoKeyRef = useRef<string | null>(null);
  const sentVideoKeyRef = useRef<string | null>(null);
  const voiceRef = useRef(OFF_VOICE_ID);
  const briefApprovedRef = useRef(false);
  const [landedCount] = useState(initialMessages.length);
  const safe = useMotionSafe();
  const [approvedBriefId, setApprovedBriefId] = useState<string | null>(null);
  const clientTools = useCoachClientTools(referenceKeysRef, voiceRef, mediaKeyRef, videoKeyRef);

  const flushEditRef = useRef<(() => Promise<void>) | null>(null);
  const [project, setProject] = useState<EditProjectView | null>(initialProject);
  /** The project a newer video covered. Cancel puts it back. */
  const heldProjectRef = useRef<EditProjectView | null>(null);
  const [ensureProject] = useEnsureCoachProjectMutation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const [awayFromBottom, setAwayFromBottom] = useState(false);
  const dispatch = useAppDispatch();
  const [retryPicture] = useRetryCoachPictureMutation();
  const [retryFrame] = useRetryStoryboardFrameMutation();
  const [libraryState, setLibraryState] = useState<Record<string, PictureLibraryState>>({});
  const [retryingToolCallId, setRetryingToolCallId] = useState<string | null>(null);
  const [pictureErrors, setPictureErrors] = useState<Record<string, string>>({});
  const { messages, setMessages, sendMessage, addToolOutput, addToolApprovalResponse, status, error, stop, clearError } = useChat({
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

  useEffect(() => {
    runWildRef.current = runWild;
  }, [runWild]);

  useEffect(() => {
    if (!threadId) return;
    const stored = window.localStorage.getItem(runWildKey(threadId));
    if (stored === null) {
      if (runWildRef.current) window.localStorage.setItem(runWildKey(threadId), "on");
      return;
    }
    setRunWild(stored === "on");
  }, [threadId]);

  useEffect(() => {
    referenceKeysRef.current = mergeReferenceKeys(
      referenceKeysFromMessages(messages),
      referenceKeys,
      sentReferenceKeysRef.current,
    );
    const attached = attachedMediaFromMessages(messages);
    mediaKeyRef.current =
      mediaKey ?? sentMediaKeyRef.current ?? attached.find((item) => item.kind === "audio")?.key ?? null;
    videoKeyRef.current =
      videoKey ?? sentVideoKeyRef.current ?? attached.find((item) => item.kind === "video")?.key ?? null;
    voiceRef.current = characterId;
  }, [messages, referenceKeys, mediaKey, videoKey, characterId]);

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior) => {
      const node = scrollRef.current;
      if (!node) return;
      node.scrollTo({ top: node.scrollHeight, behavior: safe ? behavior : "auto" });
    },
    [safe],
  );

  const messageCount = messages.length;
  const lastPartCount = messages.at(-1)?.parts.length ?? 0;
  useEffect(() => {
    if (stickRef.current) scrollToLatest("smooth");
  }, [messageCount, lastPartCount, scrollToLatest]);

  useEffect(() => {
    if (status === "streaming" && stickRef.current) scrollToLatest("auto");
  }, [messages, status, scrollToLatest]);

  const handleScroll = () => {
    const node = scrollRef.current;
    if (!node) return;
    const near = node.scrollHeight - node.scrollTop - node.clientHeight < STICK_PX;
    stickRef.current = near;
    setAwayFromBottom(!near);
  };

  useEffect(() => {
    if (!briefApprovedRef.current) return;
    const last = messages.at(-1);
    if (last?.role !== "assistant") return;
    for (const part of last.parts) {
      if (typeof part.type !== "string" || !part.type.startsWith("tool-") || !("state" in part)) continue;
      const definition = toolByName(part.type.slice("tool-".length));
      if (!definition || definition.category !== "make" || definition.approval !== "user") continue;
      if (part.state !== "approval-requested" || !("approval" in part) || !part.approval?.id) continue;
      if (part.approval.isAutomatic) continue;
      briefApprovedRef.current = false;
      addToolApprovalResponse({ id: part.approval.id, approved: true });
      return;
    }
  }, [messages, addToolApprovalResponse]);

  const ensureThread = async () => {
    if (threadIdRef.current) {
      coachRequestThreadId = threadIdRef.current;
      return threadIdRef.current;
    }
    const thread = await createThread()
      .unwrap()
      .catch((cause: unknown) => {
        throw new Error(apiErrorMessage(cause, "Couldn't start a chat."));
      });
    threadIdRef.current = thread.id;
    coachRequestThreadId = thread.id;
    setThreadId(thread.id);
    showCoachThreadInAddressBar(thread.id);
    return thread.id;
  };

  const handleSend = async (text = input) => {
    const value = text.trim();
    const pictures = referenceKeys;
    const file = mediaKey;
    const video = videoKey;
    if ((!value && pictures.length === 0 && !file && !video) || referencesBusy || status === "submitted" || status === "streaming") return;
    const spoken = value || (pictures.length === 0 ? "Use this file." : "Use these reference pictures.");
    sentReferenceKeysRef.current = mergeReferenceKeys(sentReferenceKeysRef.current, pictures);
    referenceKeysRef.current = mergeReferenceKeys(referenceKeysFromMessages(messages), pictures, sentReferenceKeysRef.current);
    if (file) sentMediaKeyRef.current = file;
    mediaKeyRef.current = file ?? sentMediaKeyRef.current;
    if (video) sentVideoKeyRef.current = video;
    videoKeyRef.current = video ?? sentVideoKeyRef.current;
    const flushEdit = flushEditRef.current;
    voiceRef.current = characterId;
    briefApprovedRef.current = false;
    stickRef.current = true;
    setApprovedBriefId(null);
    const parts = [
      { type: "text" as const, text: spoken },
      ...(pictures.length > 0 ? [{ type: "text" as const, text: referencePictureNote(pictures) }] : []),
      ...(file ? [{ type: "text" as const, text: attachedFileNote(file) }] : []),
      ...(video ? [{ type: "text" as const, text: attachedFileNote(video) }] : []),
      { type: "text" as const, text: voiceNote(characterId, characterName) },
      ...(runWildRef.current ? [{ type: "text" as const, text: runWildNote() }] : []),
    ];
    // The message shows now. The request waits for the edit save and the thread.
    coachRequestReady = (async () => {
      if (flushEdit) await flushEdit();
      const id = await ensureThread();
      window.localStorage.setItem(runWildKey(id), runWildRef.current ? "on" : "off");
    })();
    coachRequestReady.catch(() => {
      setInput((current) => current || text);
    });
    void sendMessage({ role: "user", parts });
    setInput("");
    setReferenceKeys([]);
    setMediaKey(null);
    setVideoKey(null);
  };

  const busy = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const lastBrief = lastMessage ? briefFromParts(lastMessage.parts) : null;
  const approvableBriefId =
    !busy && !referencesBusy && lastMessage && lastBrief && briefNeedsApproval(lastBrief) && hasApprovableBrief(lastMessage)
      ? lastMessage.id
      : null;

  const handleApproveBrief = async (messageId: string, modelId?: GenerationModelId, edits?: BriefEdits) => {
    if (busy || approvedBriefId) return false;
    let id: string;
    try {
      id = await ensureThread();
    } catch {
      return false;
    }
    window.localStorage.setItem(runWildKey(id), runWildRef.current ? "on" : "off");
    voiceRef.current = characterId;
    briefApprovedRef.current = true;
    stickRef.current = true;
    setApprovedBriefId(messageId);
    sendMessage({
      role: "user",
      parts: [
        { type: "text", text: BRIEF_APPROVAL_TEXT },
        { type: "text", text: voiceNote(characterId, characterName) },
        ...(modelId ? [{ type: "text" as const, text: modelNote(modelId) }] : []),
        ...(edits && briefEditNote(edits) ? [{ type: "text" as const, text: briefEditNote(edits) }] : []),
        ...(runWildRef.current ? [{ type: "text" as const, text: runWildNote() }] : []),
      ],
    });
    return true;
  };

  const handleConfirmLook = async (presetId: string) => {
    if (busy || !presetId) return;
    try {
      const id = await ensureThread();
      window.localStorage.setItem(runWildKey(id), runWildRef.current ? "on" : "off");
    } catch {
      return;
    }
    voiceRef.current = characterId;
    stickRef.current = true;
    sendMessage({
      role: "user",
      parts: [
        { type: "text", text: confirmedLookMessage(presetId) },
        { type: "text", text: voiceNote(characterId, characterName) },
        ...(runWildRef.current ? [{ type: "text" as const, text: runWildNote() }] : []),
      ],
    });
  };

  const approvedModelFor = (messageId: string) => {
    const index = messages.findIndex((message) => message.id === messageId);
    if (index < 0) return undefined;
    for (let cursor = index + 1; cursor < messages.length; cursor += 1) {
      const next = messages[cursor];
      if (!next || next.role !== "user") continue;
      if (!isBriefApprovalMessage(next)) return undefined;
      const model = modelFromMessage(next);
      return model || undefined;
    }
    return undefined;
  };

  const briefApprovalFor = (messageId: string): BriefApproval | undefined => {
    if (messageId === approvedBriefId) return "sent";
    if (messageId === approvableBriefId) return "ready";
    return undefined;
  };

  // The reply draws its own mark once the assistant message exists. A second mark here doubled it during the pause before the next step.
  const waitingForReply = busy && lastMessage?.role !== "assistant";
  const activeJobId = videoJobIdFromMessages(messages) ?? initialJob?.id ?? null;
  const jobStatusRef = useRef(initialJob?.id === activeJobId ? initialJob.status : null);
  const { data: liveJob } = useGetVideoJobQuery(activeJobId ?? "", {
    skip: !activeJobId,
    pollingInterval: activeJobId && !project && jobStatusRef.current !== "canceled" ? 3000 : 0,
  });
  const job = liveJob ?? (initialJob?.id === activeJobId ? initialJob : null);
  jobStatusRef.current = job?.status ?? null;
  const filming = job?.status === "queued" || job?.status === "running";
  const visibleProject = visibleCoachProject({
    project,
    heldProject: heldProjectRef.current,
    activeJobId,
    jobStatus: job?.status ?? null,
  });
  const projectMode = isCoachProjectMode({
    visibleProject: Boolean(visibleProject),
    activeJobId,
    jobStatus: job?.status ?? null,
  });

  useEffect(() => {
    if (job?.status === "canceled") {
      if (!project && heldProjectRef.current) setProject(heldProjectRef.current);
      return;
    }
    if (!project || !activeJobId || project.sourceVideoId === activeJobId) return;
    heldProjectRef.current = project;
    setProject(null);
  }, [activeJobId, job?.status, project]);

  useEffect(() => {
    if (!threadId || project || job?.status !== "succeeded") return;
    let stop = false;
    const run = () => {
      ensureProject(threadId)
        .unwrap()
        .then((next) => {
          if (!stop) setProject(next);
        })
        .catch(() => undefined);
    };
    run();
    const timer = window.setInterval(run, 3000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [ensureProject, job?.status, project, threadId]);

  const rememberLibraryPicture = (kind: "image" | "all", picture: LibraryUpload) => {
    dispatch(
      uploadsApi.util.updateQueryData("getUploads", kind, (uploads) =>
        uploads.some((item) => item.key === picture.key) ? uploads : [picture, ...uploads],
      ),
    );
  };

  const handleAddToLibrary = async (picture: { toolCallId: string; imageKey: string; url: string }) => {
    if (libraryState[picture.imageKey] === "adding" || libraryState[picture.imageKey] === "added") return;
    setLibraryState((current) => ({ ...current, [picture.imageKey]: "adding" }));
    setPictureErrors((current) => {
      const next = { ...current };
      delete next[picture.toolCallId];
      return next;
    });
    const entry: LibraryUpload = {
      key: picture.imageKey,
      url: picture.url,
      kind: "image",
      uploadedAt: new Date().toISOString(),
    };
    const listed = dispatch(uploadsApi.endpoints.getUploads.initiate("image", { forceRefetch: true }));
    try {
      const uploads = await listed.unwrap();
      if (!uploads.some((item) => item.key === picture.imageKey)) {
        rememberLibraryPicture("image", entry);
        rememberLibraryPicture("all", entry);
      }
      setLibraryState((current) => ({ ...current, [picture.imageKey]: "added" }));
    } catch (cause) {
      setLibraryState((current) => ({ ...current, [picture.imageKey]: "add" }));
      setPictureErrors((current) => ({
        ...current,
        [picture.toolCallId]: apiErrorMessage(cause, "Couldn't add that picture to your library."),
      }));
    } finally {
      listed.unsubscribe();
    }
  };

  const handleRetryPicture = async (picture: { messageId: string; toolCallId: string }) => {
    if (!threadId || busy || retryingToolCallId) return;
    setRetryingToolCallId(picture.toolCallId);
    setPictureErrors((current) => {
      const next = { ...current };
      delete next[picture.toolCallId];
      return next;
    });
    try {
      const output = await retryPicture({ threadId, messageId: picture.messageId, toolCallId: picture.toolCallId }).unwrap();
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== picture.messageId) return message;
          return {
            ...message,
            parts: message.parts.map((part) =>
              "toolCallId" in part && part.toolCallId === picture.toolCallId
                ? ({ ...part, output } as UIMessage["parts"][number])
                : part,
            ),
          };
        }),
      );
    } catch (cause) {
      setPictureErrors((current) => ({
        ...current,
        [picture.toolCallId]: apiErrorMessage(cause, "Couldn't retry that picture."),
      }));
    } finally {
      setRetryingToolCallId(null);
    }
  };

  const handleRegenerateFrame = async (frame: { messageId: string; toolCallId: string; frameIndex: number }) => {
    const busyKey = `${frame.toolCallId}:${frame.frameIndex}`;
    if (!threadId || busy || retryingToolCallId) return;
    setRetryingToolCallId(busyKey);
    setPictureErrors((current) => {
      const next = { ...current };
      delete next[busyKey];
      return next;
    });
    try {
      const { frame: made } = await retryFrame({ threadId, ...frame }).unwrap();
      setMessages((current) =>
        current.map((message) => {
          if (message.id !== frame.messageId) return message;
          return {
            ...message,
            parts: message.parts.map((part) => {
              if (!("toolCallId" in part) || part.toolCallId !== frame.toolCallId) return part;
              const output = "output" in part && part.output && typeof part.output === "object" ? part.output : null;
              const frames = output && "frames" in output && Array.isArray(output.frames) ? output.frames : null;
              if (!output || !frames) return part;
              return {
                ...part,
                output: {
                  ...output,
                  frames: frames.map((entry: { index?: number }) => (entry.index === frame.frameIndex ? { ...entry, ...made } : entry)),
                },
              } as UIMessage["parts"][number];
            }),
          };
        }),
      );
    } catch (cause) {
      setPictureErrors((current) => ({
        ...current,
        [busyKey]: apiErrorMessage(cause, "Couldn't make that frame again."),
      }));
    } finally {
      setRetryingToolCallId(null);
    }
  };

  const openThread = (id: string) => {
    window.location.assign(`/coach/${id}`);
  };
  const log = (
    <motion.div
      layout={safe}
      layoutId={safe ? "coach-conversation" : undefined}
      role="log"
      aria-label="Conversation with the Coach"
      aria-busy={busy}
      className={projectMode ? "flex flex-col gap-6 px-4 py-4" : "mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8"}
    >
      {messages.length === 0 ? (
        <CoachEmptyState onPick={(text) => void handleSend(text)} />
      ) : (
        messages.map((message, index) =>
          isBriefApprovalMessage(message) || isLookConfirmationMessage(message) ? null : (
          <motion.div
            key={message.id}
            initial={safe && index >= landedCount ? { opacity: 0, y: 8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={safe ? { duration: 0.28, ease: [0.22, 1, 0.36, 1] } : { duration: 0 }}
          >
            <CoachMessage
              message={message}
              characters={characters}
              pictures={picturesFromMessages(messages)}
              pictureKeys={referenceKeysFromMessages(messages)}
              pictureControls={{
                libraryState: (imageKey) => libraryState[imageKey] ?? "add",
                onAddToLibrary: (picture) => void handleAddToLibrary(picture),
                onRetry: (picture) => handleRetryPicture(picture),
                onRegenerateFrame: (frame) => handleRegenerateFrame(frame),
                retryingToolCallId,
                retryDisabled: busy || retryingToolCallId !== null,
                errorFor: (toolCallId) => pictureErrors[toolCallId] ?? null,
              }}
              briefApproval={briefApprovalFor(message.id)}
              briefModels={models}
              briefModelId={approvedModelFor(message.id)}
              onApproveBrief={(modelId, edits) => void handleApproveBrief(message.id, modelId, edits)}
              onApprove={(id) => addToolApprovalResponse({ id, approved: true })}
              onDeny={(id) => addToolApprovalResponse({ id, approved: false })}
              customPresets={customPresets}
              confirmedLookId={confirmedLookForMessage(messages, index)}
              onConfirmLook={(presetId) => void handleConfirmLook(presetId)}
              onConfirmPreset={(toolCallId, presetId) =>
                addToolOutput({
                  tool: "app_confirm_preset",
                  toolCallId,
                  output: { presetId },
                })
              }
              onAnswer={(toolCallId, answer) =>
                addToolOutput({
                  tool: "app_ask_question",
                  toolCallId,
                  output: answer,
                })
              }
              answerDisabled={busy}
              onEditAnswer={(question, answer) => {
                stickRef.current = true;
                void sendMessage({
                  role: "user",
                  parts: [{ type: "text", text: revisedAnswerMessage(question, answer) }],
                });
              }}
            />
          </motion.div>
          ),
        )
      )}
      {waitingForReply && (
        <div aria-hidden>
          <LogoMark className="size-6" />
          <div className="mt-2 flex items-center gap-1">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-pulse"
                style={{ animationDelay: `${dot * 150}ms` }}
              />
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
  const composer = (
    <CoachComposer
      variant={projectMode ? "panel" : "page"}
      value={input}
      onChange={setInput}
      onSend={() => void handleSend()}
      onStop={() => void stop()}
      busy={busy}
      uploading={referencesBusy}
      referenceKeys={referenceKeys}
      onReferenceKeys={setReferenceKeys}
      onReferencesBusy={setReferencesBusy}
      mediaKey={mediaKey}
      onMediaKey={setMediaKey}
      videoKey={videoKey}
      onVideoKey={setVideoKey}
      characterId={characterId}
      onCharacterId={setCharacterId}
      onCharacterName={setCharacterName}
      characters={characters}
      runWild={runWild}
      filming={filming}
      onRunWild={(on) => {
        setRunWild(on);
        if (threadIdRef.current) window.localStorage.setItem(runWildKey(threadIdRef.current), on ? "on" : "off");
      }}
    />
  );
  const notice = (
    <>
      {awayFromBottom && messages.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            stickRef.current = true;
            scrollToLatest("smooth");
          }}
          className="absolute bottom-full left-1/2 z-20 mb-3 inline-flex h-10 -translate-x-1/2 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-popover px-4 text-sm font-medium shadow-lg outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowDown aria-hidden className="size-4" />
          Jump to latest
        </button>
      ) : null}
      {error && (
        <div
          role="alert"
          className="mx-3 mb-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm"
        >
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            {error.message || "Something went wrong."} Send your message again to retry.
          </p>
          <button
            type="button"
            onClick={clearError}
            aria-label="Dismiss error"
            className="-m-1 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      )}
    </>
  );

  if (projectMode) {
    return (
      <LayoutGroup>
        <h1 className="sr-only">Coach</h1>
        <p className="sr-only" role="status">
          {busy ? "The Coach is replying." : ""}
        </p>
        <CoachProjectView
          project={visibleProject}
          job={job}
          title={threads.find((thread) => thread.id === threadId)?.title || job?.prompt || "Video"}
          messages={messages}
          flushRef={flushEditRef}
          threads={threads}
          activeId={threadId}
          onSelectThread={openThread}
          onCreateThread={() => window.location.assign("/coach")}
          log={log}
          composer={composer}
          notice={<div className="relative shrink-0">{notice}</div>}
          scrollRef={scrollRef}
          onScroll={handleScroll}
          models={models}
        />
      </LayoutGroup>
    );
  }

  return (
    <LayoutGroup>
    <div className="relative flex h-full min-h-0 flex-col md:flex-row">
      <h1 className="sr-only">Coach</h1>
      <Link
        href="/dashboard"
        className="absolute top-3 right-4 z-30 inline-flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm text-foreground/80 outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Return
      </Link>
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
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div ref={scrollRef} onScroll={handleScroll} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {log}
        </div>
        <p className="sr-only" role="status">
          {busy ? "The Coach is replying." : ""}
        </p>
        <div className="relative shrink-0">
          {notice}
          {composer}
        </div>
      </div>
    </div>
    </LayoutGroup>
  );
}
