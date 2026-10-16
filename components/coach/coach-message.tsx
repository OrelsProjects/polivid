import type { UIMessage } from "ai";
import Link from "next/link";
import { splitCoachContent } from "@/lib/coach/brief-blocks";
import { linkKnownIds, resultLinksFromParts } from "@/lib/coach/result-links";
import { proseWithoutReferenceNote, referenceKeysFromNote } from "@/lib/coach/reference-notes";
import { proseWithoutVoiceNote, voiceChoiceLabel, voiceFromNote } from "@/lib/coach/voice-notes";
import type { CharacterSummary } from "@/lib/characters/types";
import { CoachActionCard } from "@/components/coach/coach-action-card";
import { CoachApprovalCard } from "@/components/coach/coach-approval-card";
import { CoachBriefCard, type BriefApproval } from "@/components/coach/coach-brief-card";
import { CoachPresetCard } from "@/components/coach/coach-preset-card";
import { CoachQuestionCard } from "@/components/coach/coach-question-card";
import { uploadFileUrl } from "@/lib/storage/upload-key";
import { modeAcceptsReferenceImages, videoModeById } from "@/lib/video/modes";
import { modeCanNarrate } from "@/lib/voice/constants";
import { cn } from "@/lib/utils";

export function CoachMessage({
  message,
  hasReferencePictures = false,
  hasVoice = false,
  characters = [],
  briefApproval,
  onApproveBrief,
  onApprove,
  onDeny,
  onAnswer,
}: {
  message: UIMessage;
  hasReferencePictures?: boolean;
  hasVoice?: boolean;
  characters?: CharacterSummary[];
  /** Shows Approve under this message's brief, or the approved note after it was pressed. */
  briefApproval?: BriefApproval;
  onApproveBrief?: () => void;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
  onAnswer: (toolCallId: string, answer: string) => void;
}) {
  const mine = message.role === "user";
  const resultLinks = resultLinksFromParts(message.parts);
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[min(42rem,100%)] rounded-2xl px-4 py-3 text-sm",
          mine ? "bg-foreground text-background" : "border border-border bg-white shadow-sm",
        )}
      >
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            const pictures = referenceKeysFromNote(part.text);
            const voiceLabel = voiceChoiceLabel(part.text);
            const character = voiceLabel ? characters.find((item) => item.id === voiceFromNote(part.text)) : undefined;
            const { prose, brief } = splitCoachContent(proseWithoutVoiceNote(proseWithoutReferenceNote(part.text)));
            if (!prose && pictures.length === 0 && !brief && !voiceLabel) return null;
            return (
              <div key={`${message.id}-text-${index}`}>
                {prose && (
                  <p className="whitespace-pre-wrap">
                    {linkKnownIds(prose, resultLinks).map((piece, pieceIndex) =>
                      piece.kind === "link" ? (
                        <Link
                          key={`${message.id}-link-${index}-${pieceIndex}`}
                          href={piece.href}
                          className="font-medium text-primary underline-offset-4 hover:underline"
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
          if (part.type === "tool-create_video" || part.type === "tool-start_production") {
            const label = part.type === "tool-create_video" ? "Generate this video" : "Start this production";
            const input = "input" in part ? (part.input as Record<string, unknown> | undefined) : undefined;
            const mode = videoModeById(String(input?.mode ?? "prompt"));
            const namedReferences = Array.isArray(input?.referenceKeys) && input.referenceKeys.length > 0;
            const withReferences =
              part.type === "tool-create_video" &&
              ((mode && modeAcceptsReferenceImages(mode) && hasReferencePictures) || namedReferences);
            const namedVoice =
              typeof input?.characterId === "string" && input.characterId !== "" && input.characterId !== "off";
            const withVoice =
              namedVoice ||
              (hasVoice && (part.type === "tool-start_production" || (mode ? modeCanNarrate(mode.id) : true)));
            const detail =
              part.type === "tool-create_video"
                ? `${String(input?.mode ?? "prompt")} · ${String(input?.format ?? "")} · ${String(input?.length ?? "")}s · ${String(input?.presetId ?? "auto")}${withReferences ? " · reference pictures" : ""}${withVoice ? " · character" : ""}`
                : `${String(input?.format ?? "9:16")} · ${String(input?.durationSec ?? 30)}s${withVoice ? " · character" : ""}`;
            if (part.state === "approval-requested") {
              return (
                <CoachApprovalCard
                  key={part.toolCallId}
                  title={label}
                  detail={detail}
                  automatic={"approval" in part && part.approval?.isAutomatic}
                  onApprove={() => "approval" in part && part.approval?.id && onApprove(part.approval.id)}
                  onDeny={() => "approval" in part && part.approval?.id && onDeny(part.approval.id)}
                />
              );
            }
            if (part.state === "approval-responded") {
              const approved = "approval" in part && part.approval?.approved === true;
              return (
                <CoachActionCard
                  key={part.toolCallId}
                  label={label}
                  state={approved ? "Approved. Starting…" : "Denied"}
                />
              );
            }
            if (part.state === "output-available") {
              const output = part.output as { error?: string; jobId?: string; productionId?: string } | undefined;
              const videoHref = output?.jobId ? `/videos/${output.jobId}` : undefined;
              const productionHref = output?.productionId ? `/productions/${output.productionId}` : undefined;
              const state = output?.error
                ? output.error
                : output?.jobId
                  ? "Queued"
                  : output?.productionId
                    ? "Started"
                    : "Done";
              return (
                <CoachActionCard
                  key={part.toolCallId}
                  label={label}
                  state={state}
                  href={output?.error ? undefined : videoHref ?? productionHref}
                  linkLabel={videoHref ? "Open video" : productionHref ? "Open production" : undefined}
                />
              );
            }
            if (part.state === "output-error") {
              return <CoachActionCard key={part.toolCallId} label={label} state={part.errorText || "Failed"} />;
            }
            if (part.state === "output-denied") {
              return <CoachActionCard key={part.toolCallId} label={label} state="Denied" />;
            }
            if (part.state === "input-available" || part.state === "input-streaming") {
              return <CoachActionCard key={part.toolCallId} label={label} state="Preparing…" />;
            }
          }
          if (typeof part.type === "string" && part.type.startsWith("tool-") && "state" in part) {
            const name = part.type.replace("tool-", "").replaceAll("_", " ");
            if (part.state === "output-available") {
              return <CoachActionCard key={`${message.id}-${index}`} label={name} state="Done" />;
            }
            if (part.state === "input-available" || part.state === "input-streaming") {
              return <CoachActionCard key={`${message.id}-${index}`} label={name} state="Working…" />;
            }
          }
          return null;
        })}
      </div>
    </div>
  );
}
