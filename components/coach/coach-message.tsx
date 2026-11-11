import type { UIMessage } from "ai";
import { FileAudio, FileVideo } from "lucide-react";
import Link from "next/link";
import { splitCoachContent } from "@/lib/coach/brief-blocks";
import { linkKnownIds, resultLinksFromParts } from "@/lib/coach/result-links";
import { proseWithoutAttachedFileNote, proseWithoutReferenceNote, referenceKeysFromNote, attachedFilesFromNote } from "@/lib/coach/reference-notes";
import { hasRunWildNote, proseWithoutRunWildNote } from "@/lib/coach/run-wild-notes";
import { proseWithoutVoiceNote, voiceChoiceLabel, voiceFromNote } from "@/lib/coach/voice-notes";
import type { CharacterSummary } from "@/lib/characters/types";
import {
  editSourceKey,
  isPictureTool,
  pictureAlt,
  pictureFormat,
  pictureWorkingLabel,
} from "@/lib/coach/picture-preview";
import {
  storyboardFormat,
  storyboardFramesFromInput,
  storyboardFramesFromOutput,
} from "@/lib/coach/storyboard";
import { toolByName } from "@/lib/tools/registry";
import { toolResultView } from "@/lib/tools/result";
import { CoachActionCard } from "@/components/coach/coach-action-card";
import { CoachStoryboard } from "@/components/coach/coach-storyboard";
import { CoachApprovalCard } from "@/components/coach/coach-approval-card";
import type { BriefEdits } from "@/lib/coach/brief-edit-notes";
import { CoachBriefCard, type BriefApproval } from "@/components/coach/coach-brief-card";
import { CoachPicture, type PictureLibraryState } from "@/components/coach/coach-picture";
import { CoachPresetChoice } from "@/components/coach/coach-preset-choice";
import { presetIdFromConfirm } from "@/lib/coach/preset-confirm";
import type { CustomPresetTile } from "@/components/preset-picker";
import { CoachProse } from "@/components/coach/coach-prose";
import { CoachQuestionCard } from "@/components/coach/coach-question-card";
import { LogoMark } from "@/components/logo";
import { picturesFromMessage, type CoachPictureRef } from "@/lib/coach/picture-mentions";
import { uploadFileUrl } from "@/lib/storage/upload-key";
import type { GenerationModelId } from "@/lib/video/models";
import { cn } from "@/lib/utils";

export type CoachPictureControls = {
  libraryState: (imageKey: string) => PictureLibraryState;
  onAddToLibrary: (picture: { toolCallId: string; imageKey: string; url: string }) => void;
  onRetry: (picture: { messageId: string; toolCallId: string }) => void | Promise<void>;
  onRegenerateFrame: (frame: { messageId: string; toolCallId: string; frameIndex: number }) => void | Promise<void>;
  /** A picture id, or "toolCallId:frameIndex" while one storyboard frame is being made again. */
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
  pictures,
  pictureKeys = [],
  pictureControls,
  briefApproval,
  briefModels,
  briefModelId,
  onApproveBrief,
  onApprove,
  onDeny,
  onAnswer,
  onEditAnswer,
  onConfirmPreset,
  onConfirmLook,
  confirmedLookId,
  customPresets,
  answerDisabled = false,
}: {
  message: UIMessage;
  /** Pictures already made in this thread. A cited frame id renders as the picture. */
  pictures?: readonly CoachPictureRef[];
  characters?: CharacterSummary[];
  /** Pictures already attached in the thread, used when an edit omits its source. */
  pictureKeys?: readonly string[];
  /** Add to library and retry on a finished picture. */
  pictureControls?: CoachPictureControls;
  /** Shows Approve under this message's brief, or the approved note after it was pressed. */
  briefApproval?: BriefApproval;
  /** Footage models this server can film with. */
  briefModels?: readonly GenerationModelId[];
  /** Model named on the approval that followed this brief. */
  briefModelId?: GenerationModelId;
  onApproveBrief?: (modelId?: GenerationModelId, edits?: BriefEdits) => void;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onAnswer: (toolCallId: string, answer: string) => void;
  /** Sends a replacement for an answer that was already given. */
  onEditAnswer?: (question: string, answer: string) => void;
  /** Confirms the look, or a different preset, before pictures are generated. */
  onConfirmPreset?: (toolCallId: string, presetId: string) => void;
  /** Confirms the suggested look from the card, before pictures are generated. */
  onConfirmLook?: (presetId: string) => void;
  /** Preset id chosen after this message's suggestion. */
  confirmedLookId?: string;
  customPresets?: readonly CustomPresetTile[];
  /** The Coach is replying, so the saved answer stays put. */
  answerDisabled?: boolean;
}) {
  const mine = message.role === "user";
  const pictureOnly = !mine && finishedPicture(message);
  const resultLinks = resultLinksFromParts(message.parts);
  const hasPresetConfirm = message.parts.some((part) => part.type === "tool-app_confirm_preset");
  const knownPictures = pictures ?? picturesFromMessage(message);
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(40rem,100%)] min-w-0 text-[15px] leading-relaxed [overflow-wrap:anywhere]",
          mine
            ? "rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground selection:bg-primary-foreground selection:text-primary"
            : "w-full text-foreground",
        )}
      >
        <span className="sr-only">{mine ? "You said:" : "Coach said:"}</span>
        {mine ? null : <LogoMark className="mb-2 size-6" />}
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            if (pictureOnly) return null;
            const pictures = referenceKeysFromNote(part.text);
            const voiceLabel = voiceChoiceLabel(part.text);
            const character = voiceLabel ? characters.find((item) => item.id === voiceFromNote(part.text)) : undefined;
            const attachedFiles = attachedFilesFromNote(part.text);
            const runWild = mine && hasRunWildNote(part.text);
            const { prose, brief } = splitCoachContent(
              proseWithoutRunWildNote(
                proseWithoutVoiceNote(proseWithoutAttachedFileNote(proseWithoutReferenceNote(part.text))),
              ),
            );
            if (!prose && pictures.length === 0 && !brief && !voiceLabel && attachedFiles.length === 0 && !runWild) return null;
            return (
              <div key={`${message.id}-text-${index}`}>
                {prose &&
                  (mine ? (
                    <p className="whitespace-pre-wrap">
                      {linkKnownIds(prose, resultLinks).map((piece, pieceIndex) =>
                        piece.kind === "link" ? (
                          <Link
                            key={`${message.id}-link-${index}-${pieceIndex}`}
                            href={piece.href}
                            className={cn(
                              "rounded-sm font-medium underline underline-offset-4 outline-none hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50",
                              "decoration-primary-foreground/80",
                            )}
                          >
                            {piece.text}
                          </Link>
                        ) : (
                          <span key={`${message.id}-text-${index}-${pieceIndex}`}>{piece.text}</span>
                        ),
                      )}
                    </p>
                  ) : (
                    <CoachProse text={prose} links={resultLinks} pictures={knownPictures} />
                  ))}
                {runWild && <p className="mt-2 text-xs text-primary-foreground/80">Run wild</p>}
                {voiceLabel && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {character?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- character thumbnail
                      <img
                        src={character.imageUrl}
                        alt={`Picture of ${character.name}`}
                        className="size-8 rounded-lg object-cover opacity-80"
                      />
                    ) : null}
                    <span className={mine ? "text-primary-foreground/80" : "opacity-80"}>
                      Character: {character?.name ?? voiceLabel}
                    </span>
                  </div>
                )}
                {attachedFiles.map((attachedFile) => (
                  <p
                    key={attachedFile.key}
                    className={cn(
                      "mt-2 flex items-center gap-1.5 text-xs",
                      mine ? "text-primary-foreground/90" : "opacity-90",
                    )}
                  >
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
                {brief && (
                  <CoachBriefCard
                    brief={brief}
                    models={briefModels}
                    approvedModelId={briefModelId}
                    approval={briefApproval}
                    onApprove={onApproveBrief}
                  />
                )}
              </div>
            );
          }
          if (part.type === "step-start") return null;
          if (part.type === "tool-suggest_preset" && part.state === "output-available" && !hasPresetConfirm) {
            const output = part.output as { preset?: { id?: string }; reason?: string } | undefined;
            const input =
              "input" in part && part.input && typeof part.input === "object"
                ? (part.input as { engine?: string })
                : {};
            if (output?.preset?.id) {
              return (
                <CoachPresetChoice
                  key={part.toolCallId}
                  recommendedId={output.preset.id}
                  reason={output.reason}
                  engine={input.engine === "motion" ? "motion" : "footage"}
                  customPresets={customPresets}
                  confirmedId={confirmedLookId}
                  disabled={answerDisabled}
                  onConfirm={onConfirmLook}
                />
              );
            }
          }
          if (part.type === "tool-app_confirm_preset") {
            const input =
              "input" in part && part.input && typeof part.input === "object"
                ? (part.input as { presetId?: string; reason?: string; engine?: string })
                : {};
            const recommendedId = typeof input.presetId === "string" ? input.presetId : "";
            const confirmedId = part.state === "output-available" ? presetIdFromConfirm("output" in part ? part.output : undefined) : "";
            const engine = input.engine === "motion" ? "motion" : "footage";
            if (recommendedId && (part.state === "input-streaming" || part.state === "input-available" || part.state === "output-available")) {
              return (
                <CoachPresetChoice
                  key={part.toolCallId}
                  recommendedId={recommendedId}
                  reason={typeof input.reason === "string" ? input.reason : undefined}
                  engine={engine}
                  customPresets={customPresets}
                  confirmedId={confirmedId}
                  disabled={answerDisabled}
                  onConfirm={
                    onConfirmPreset && "toolCallId" in part && typeof part.toolCallId === "string"
                      ? (presetId) => onConfirmPreset(part.toolCallId, presetId)
                      : undefined
                  }
                />
              );
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
                  disabled={answerDisabled}
                  onAnswer={(answer) => onAnswer(part.toolCallId, answer)}
                  onEdit={
                    onEditAnswer
                      ? (answer) => onEditAnswer(input.question ?? "Which option?", answer)
                      : undefined
                  }
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
            if (name === "make_storyboard") {
              const approved = part.state === "approval-responded" && "approval" in part && part.approval?.approved === true;
              const making =
                part.state === "input-streaming" ||
                part.state === "input-available" ||
                (part.state === "approval-requested" && automatic) ||
                approved;
              if (part.state === "output-available") {
                const frames = storyboardFramesFromOutput("output" in part ? part.output : undefined);
                if (frames.length > 0) {
                  const failed =
                    part.output && typeof part.output === "object" && typeof (part.output as { failed?: unknown }).failed === "number"
                      ? (part.output as { failed: number }).failed
                      : 0;
                  return (
                    <CoachStoryboard
                      key={key}
                      format={storyboardFormat(input)}
                      frames={frames}
                      failed={failed}
                      regenerate={
                        pictureControls && toolCallId
                          ? {
                              busyIndex: pictureControls.retryingToolCallId?.startsWith(`${toolCallId}:`)
                                ? Number(pictureControls.retryingToolCallId.split(":").at(-1))
                                : null,
                              disabled: pictureControls.retryDisabled,
                              errorFor: (frameIndex) => pictureControls.errorFor(`${toolCallId}:${frameIndex}`),
                              onRegenerate: (frameIndex) =>
                                pictureControls.onRegenerateFrame({ messageId: message.id, toolCallId, frameIndex }),
                            }
                          : undefined
                      }
                    />
                  );
                }
              } else if (making) {
                return (
                  <CoachStoryboard
                    key={key}
                    format={storyboardFormat(input)}
                    frames={storyboardFramesFromInput(input)}
                    working
                  />
                );
              }
            }
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
