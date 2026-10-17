import type { UIMessage } from "ai";
import { FileAudio, FileVideo } from "lucide-react";
import Link from "next/link";
import { splitCoachContent } from "@/lib/coach/brief-blocks";
import { linkKnownIds, resultLinksFromParts } from "@/lib/coach/result-links";
import { proseWithoutAttachedFileNote, proseWithoutReferenceNote, referenceKeysFromNote, attachedFilesFromNote } from "@/lib/coach/reference-notes";
import { proseWithoutVoiceNote, voiceChoiceLabel, voiceFromNote } from "@/lib/coach/voice-notes";
import type { CharacterSummary } from "@/lib/characters/types";
import {
  editSourceKey,
  isPictureTool,
  pictureAlt,
  pictureFormat,
  pictureWorkingLabel,
} from "@/lib/coach/picture-preview";
import { toolByName } from "@/lib/tools/registry";
import { toolResultView } from "@/lib/tools/result";
import { CoachActionCard } from "@/components/coach/coach-action-card";
import { CoachApprovalCard } from "@/components/coach/coach-approval-card";
import { CoachBriefCard, type BriefApproval } from "@/components/coach/coach-brief-card";
import { CoachPicture, type PictureLibraryState } from "@/components/coach/coach-picture";
import { CoachPresetCard } from "@/components/coach/coach-preset-card";
import { CoachQuestionCard } from "@/components/coach/coach-question-card";
import { uploadFileUrl } from "@/lib/storage/upload-key";
import { cn } from "@/lib/utils";

export type CoachPictureControls = {
  libraryState: (imageKey: string) => PictureLibraryState;
  onAddToLibrary: (picture: { toolCallId: string; imageKey: string; url: string }) => void;
  onRetry: (picture: { messageId: string; toolCallId: string }) => void | Promise<void>;
  retryingToolCallId: string | null;
  /** Coach is replying, or another picture retry is already running. */
  retryDisabled: boolean;
  errorFor: (toolCallId: string) => string | null;
};

const finishedPicture = (message: UIMessage) =>
  message.parts.some((part) => {
    if (typeof part.type !== "string" || !part.type.startsWith("tool-") || !("state" in part)) return false;
    if (part.state !== "output-available" || !isPictureTool(part.type.slice("tool-".length))) return false;
    return Boolean(toolResultView("output" in part ? part.output : undefined).imageUrl);
  });

export function CoachMessage({
  message,
  characters = [],
  pictureKeys = [],
  pictureControls,
  briefApproval,
  onApproveBrief,
  onApprove,
  onDeny,
  onAnswer,
}: {
  message: UIMessage;
  characters?: CharacterSummary[];
  /** Pictures already attached in the thread, used when an edit omits its source. */
  pictureKeys?: readonly string[];
  /** Add to library and retry on a finished picture. */
  pictureControls?: CoachPictureControls;
  /** Shows Approve under this message's brief, or the approved note after it was pressed. */
  briefApproval?: BriefApproval;
  onApproveBrief?: () => void;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onAnswer: (toolCallId: string, answer: string) => void;
}) {
  const mine = message.role === "user";
  const pictureOnly = !mine && finishedPicture(message);
  const resultLinks = resultLinksFromParts(message.parts);
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(40rem,100%)] min-w-0 text-[15px] leading-relaxed [overflow-wrap:anywhere]",
          mine ? "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground" : "w-full text-foreground",
        )}
      >
        <span className="sr-only">{mine ? "You said:" : "Coach said:"}</span>
        {mine ? null : (
          <p aria-hidden className="mb-2 font-label text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Coach
          </p>
        )}
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            if (pictureOnly) return null;
            const pictures = referenceKeysFromNote(part.text);
            const voiceLabel = voiceChoiceLabel(part.text);
            const character = voiceLabel ? characters.find((item) => item.id === voiceFromNote(part.text)) : undefined;
            const attachedFiles = attachedFilesFromNote(part.text);
            const { prose, brief } = splitCoachContent(
              proseWithoutVoiceNote(proseWithoutAttachedFileNote(proseWithoutReferenceNote(part.text))),
            );
            if (!prose && pictures.length === 0 && !brief && !voiceLabel && attachedFiles.length === 0) return null;
            return (
              <div key={`${message.id}-text-${index}`}>
                {prose && (
                  <p className="whitespace-pre-wrap">
                    {linkKnownIds(prose, resultLinks).map((piece, pieceIndex) =>
                      piece.kind === "link" ? (
                        <Link
                          key={`${message.id}-link-${index}-${pieceIndex}`}
                          href={piece.href}
                          className={cn(
                            "rounded-sm font-medium underline underline-offset-4 outline-none hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50",
                            mine ? "decoration-primary-foreground/80" : "decoration-primary",
                          )}
                        >
                          {piece.text}
                        </Link>
                      ) : (
                        <span key={`${message.id}-text-${index}-${pieceIndex}`}>{piece.text}</span>
                      ),
                    )}
                  </p>
                )}
                {voiceLabel && (
                  <div className="mt-2 flex items-center gap-2 text-xs opacity-80">
                    {character?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- character thumbnail
                      <img
                        src={character.imageUrl}
                        alt={`Picture of ${character.name}`}
                        className="size-8 rounded-lg object-cover"
                      />
                    ) : null}
                    <span>Character: {character?.name ?? voiceLabel}</span>
                  </div>
                )}
                {attachedFiles.map((attachedFile) => (
                  <p key={attachedFile.key} className="mt-2 flex items-center gap-1.5 text-xs opacity-90">
                    {attachedFile.kind === "audio" ? (
                      <FileAudio aria-hidden className="size-3.5" />
                    ) : (
                      <FileVideo aria-hidden className="size-3.5" />
                    )}
                    Attached {attachedFile.kind === "audio" ? "audio" : "video"}
                  </p>
                ))}
                {pictures.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pictures.map((key, pictureIndex) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={key}
                        src={uploadFileUrl(key)}
                        alt={`Reference picture ${pictureIndex + 1}`}
                        className="size-16 rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
                {brief && <CoachBriefCard brief={brief} approval={briefApproval} onApprove={onApproveBrief} />}
              </div>
            );
          }
          if (part.type === "step-start") return null;
          if (part.type === "tool-suggest_preset" && part.state === "output-available") {
            const output = part.output as { preset?: { id?: string }; reason?: string } | undefined;
            if (output?.preset?.id) {
              return <CoachPresetCard key={part.toolCallId} presetId={output.preset.id} reason={output.reason} />;
            }
          }
          if (part.type === "tool-app_ask_question") {
            const input = "input" in part ? (part.input as { question?: string; options?: string[] }) : {};
            const answered = part.state === "output-available" ? String(part.output ?? "") : undefined;
            if (part.state === "input-available" || part.state === "output-available") {
              return (
                <CoachQuestionCard
                  key={part.toolCallId}
                  question={input.question ?? "Which option?"}
                  options={input.options}
                  answered={answered}
                  onAnswer={(answer) => onAnswer(part.toolCallId, answer)}
                />
              );
            }
          }
          if (typeof part.type === "string" && part.type.startsWith("tool-") && "state" in part) {
            const name = part.type.slice("tool-".length);
            const definition = toolByName(name);
            const label = definition?.title ?? name.replaceAll("_", " ");
            const input = "input" in part && part.input && typeof part.input === "object" ? (part.input as Record<string, unknown>) : {};
            const toolCallId = "toolCallId" in part && typeof part.toolCallId === "string" ? part.toolCallId : null;
            const key = toolCallId ?? `${message.id}-${index}`;
            const pictureTool = isPictureTool(name) ? name : null;
            const automatic = "approval" in part && part.approval?.isAutomatic === true;
            const workingPicture =
              pictureTool &&
              (part.state === "input-streaming" ||
                part.state === "input-available" ||
                (part.state === "approval-requested" && automatic) ||
                (part.state === "approval-responded" && "approval" in part && part.approval?.approved === true));
            if (pictureTool && workingPicture) {
              const source = pictureTool === "edit_image" ? editSourceKey(input, pictureKeys) : null;
              return (
                <CoachPicture
                  key={key}
                  phase={source ? "edit" : "generate"}
                  src={source ? uploadFileUrl(source) : null}
                  format={pictureFormat(input)}
                  label={pictureWorkingLabel(pictureTool)}
                />
              );
            }
            if (definition?.approval === "user" && part.state === "approval-requested") {
              if (automatic) {
                return <CoachActionCard key={key} label={label} state="Starting…" tone="working" />;
              }
              return (
                <CoachApprovalCard
                  key={key}
                  title={label}
                  detail={definition.approvalDetail?.(input) ?? ""}
                  spendsCredits={definition.effects.spendsCredits}
                  destructive={definition.effects.destructive}
                  onApprove={() => "approval" in part && part.approval?.id && onApprove(part.approval.id)}
                  onDeny={() => "approval" in part && part.approval?.id && onDeny(part.approval.id)}
                />
              );
            }
            if (part.state === "approval-responded") {
              const approved = "approval" in part && part.approval?.approved === true;
              return (
                <CoachActionCard
                  key={key}
                  label={label}
                  state={approved ? (automatic ? "Starting…" : "Approved. Starting…") : "Not approved"}
                  tone={approved ? "working" : "done"}
                />
              );
            }
            if (part.state === "output-available") {
              const output = "output" in part ? part.output : undefined;
              const view = toolResultView(output);
              if (pictureTool && view.imageUrl) {
                if (toolCallId && pictureControls?.retryingToolCallId === toolCallId) {
                  return <CoachPicture key={key} phase="edit" src={view.imageUrl} label="Retrying picture" />;
                }
                const imageKey = view.imageKey;
                const imageUrl = view.imageUrl;
                const libraryState = imageKey && pictureControls ? pictureControls.libraryState(imageKey) : "add";
                return (
                  <CoachPicture
                    key={key}
                    phase="done"
                    src={imageUrl}
                    format={pictureFormat(input)}
                    label={pictureAlt(pictureTool, output)}
                    actions={
                      pictureControls
                        ? {
                            library:
                              imageKey && toolCallId
                                ? {
                                    state: libraryState,
                                    onAdd: () =>
                                      pictureControls.onAddToLibrary({
                                        toolCallId,
                                        imageKey,
                                        url: imageUrl,
                                      }),
                                  }
                                : undefined,
                            retry: toolCallId
                              ? {
                                  disabled: pictureControls.retryDisabled || libraryState === "adding",
                                  onRetry: () => pictureControls.onRetry({ messageId: message.id, toolCallId }),
                                }
                              : undefined,
                            error: toolCallId ? pictureControls.errorFor(toolCallId) : null,
                          }
                        : undefined
                    }
                  />
                );
              }
              return (
                <CoachActionCard
                  key={key}
                  label={label}
                  state={view.state}
                  tone={view.tone}
                  href={view.href}
                  linkLabel={view.linkLabel}
                />
              );
            }
            if (part.state === "output-error") {
              const errorText = "errorText" in part && typeof part.errorText === "string" ? part.errorText : "";
              return <CoachActionCard key={key} label={label} state={errorText || "Something went wrong"} tone="error" />;
            }
            if (part.state === "output-denied") {
              return <CoachActionCard key={key} label={label} state="Not approved" />;
            }
            if (part.state === "input-available" || part.state === "input-streaming") {
              return (
                <CoachActionCard
                  key={key}
                  label={label}
                  state={definition?.approval === "user" ? "Preparing…" : "Working…"}
                  tone="working"
                />
              );
            }
          }
          return null;
        })}
      </div>
    </div>
  );
}
