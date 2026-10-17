"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { UpgradeDialog } from "@/components/billing/upgrade-dialog";
import { StatusTimeline } from "@/components/production/status-timeline";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  activityLabel,
  formatElapsed,
  generationItems,
  planningItemsFromStage,
  prettyTarget,
  REVIEW_REJECTED,
  STATUS_LABEL,
  STEP_KIND_LABEL,
  STEP_STATUS_LABEL,
} from "@/lib/production/progress";
import type { ProductionView } from "@/lib/production/types";
import { referencePictures } from "@/lib/production/references";
import {
  isLiveProductionStatus,
  type AssumptionsRecord,
  type CreativeBrief,
  type InputRecord,
  type QuestionsRecord,
  type Requirements,
  type Script,
  type Shot,
} from "@/lib/production/schema";
import { uploadFileUrl } from "@/lib/storage/upload-key";
import { apiErrorMessage, insufficientCredits } from "@/lib/store/api-errors";
import { useGetProductionEstimateQuery } from "@/lib/store/endpoints/billing";
import {
  productionsApi,
  useApproveProductionMutation,
  useCancelProductionMutation,
  useGetProductionQuery,
  useOpenProductionEditorMutation,
  useRegenerateProductionMutation,
  useRetryProductionMutation,
  useSubmitProductionAnswersMutation,
  useUpdateProductionEntityMutation,
} from "@/lib/store/endpoints/productions";
import { useAppSelector } from "@/lib/store/hooks";

const POLL_MS = 1500;

const statusLine = (production: ProductionView, estimatedCredits: number | null) => {
  const status = STATUS_LABEL[production.status] ?? production.status;
  const activity = activityLabel(production);
  return [
    status,
    activity !== status ? activity : null,
    production.format,
    `${production.targetDurationSec}s`,
    `$${production.spentUsd.toFixed(2)} / $${production.budgetUsd.toFixed(2)}`,
    estimatedCredits !== null ? `${estimatedCredits.toLocaleString()} credits` : null,
  ]
    .filter(Boolean)
    .join(" · ");
};

export function ProductionWorkspace({ initial }: { initial: ProductionView }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<{ required: number; balance: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const selectProduction = useMemo(() => productionsApi.endpoints.getProduction.select(initial.id), [initial.id]);
  const production = useAppSelector(selectProduction).data ?? initial;
  const [submitAnswers] = useSubmitProductionAnswersMutation();
  const [approveProduction] = useApproveProductionMutation();
  const [regenerateProduction] = useRegenerateProductionMutation();
  const [cancelProduction] = useCancelProductionMutation();
  const [openProductionEditor] = useOpenProductionEditorMutation();
  const [retryProduction] = useRetryProductionMutation();
  const [updateProductionEntity] = useUpdateProductionEntityMutation();
  const hasEstimate = production.status === "preview" || production.status === "ready";
  const { data: estimatedCredits = null } = useGetProductionEstimateQuery(production.id, { skip: !hasEstimate });

  const entity = (kind: string, key?: string) =>
    production.entities.find((entry) => entry.kind === kind && (!key || entry.stableKey === key))?.current?.data;

  const script = entity("script") as Script | undefined;
  const brief = entity("brief") as CreativeBrief | undefined;
  const assumptions = entity("assumptions") as AssumptionsRecord | undefined;
  const questions = entity("questions") as QuestionsRecord | undefined;
  const requirements = entity("requirements") as Requirements | undefined;
  const shots = production.entities.filter((entry) => entry.kind === "shot").map((entry) => entry.current?.data as Shot);
  const references = referencePictures(entity("input") as InputRecord | undefined);

  const doneSteps = production.steps.filter((step) => step.status === "succeeded").length;
  const live = isLiveProductionStatus(production.status) || busy === "answers";
  // Anchor the clock to the server-side run start so it survives page reloads.
  const runStartedAt = production.runStartedAt ? Date.parse(production.runStartedAt) : null;
  const elapsed = live && runStartedAt !== null ? formatElapsed(runStartedAt, now) : null;

  // Polling pauses while an action is in flight so a stale poll can't undo its optimistic update.
  useGetProductionQuery(initial.id, {
    pollingInterval: live && !busy ? POLL_MS : 0,
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), POLL_MS);
    return () => clearInterval(timer);
  }, [live]);

  const showActionError = (error: unknown, fallback: string) => {
    const shortfall = insufficientCredits(error);
    if (shortfall) setUpgrade(shortfall);
    else setMessage(apiErrorMessage(error, fallback));
  };

  const handleAnswers = async () => {
    setBusy("answers");
    setMessage(null);
    try {
      await submitAnswers({ id: production.id, answers }).unwrap();
    } catch (error) {
      setMessage(apiErrorMessage(error, "Couldn't save those answers."));
    }
    setBusy(null);
  };

  const handleApprove = async () => {
    setBusy("approve");
    try {
      await approveProduction(production.id).unwrap();
    } catch (error) {
      showActionError(error, "Couldn't start generation.");
    }
    setBusy(null);
  };

  const handleRegenerate = async () => {
    setBusy("regenerate");
    setMessage(null);
    try {
      const copyId = await regenerateProduction(production.id).unwrap();
      if (copyId) {
        router.push(`/productions/${copyId}`);
        return;
      }
    } catch (error) {
      showActionError(error, "Couldn't regenerate this video.");
    }
    setBusy(null);
  };

  const handleCancel = async () => {
    setBusy("cancel");
    await cancelProduction(production.id);
    setBusy(null);
  };

  const handleOpenEditor = async () => {
    if (production.editProjectId) {
      router.push(`/editor/${production.editProjectId}`);
      return;
    }
    setBusy("editor");
    setMessage(null);
    try {
      const projectId = await openProductionEditor(production.id).unwrap();
      router.push(`/editor/${projectId}`);
    } catch (error) {
      setMessage(apiErrorMessage(error, "Couldn't open this in the editor."));
    }
    setBusy(null);
  };

  const handleRetry = async (stepId?: string) => {
    setBusy(stepId ?? "retry");
    setMessage(null);
    try {
      await retryProduction({ id: production.id, stepId }).unwrap();
    } catch (error) {
      setMessage(apiErrorMessage(error, "Couldn't retry from the last step."));
    }
    setBusy(null);
  };

  const canceled = production.status === "canceled";

  const pendingQuestions =
    production.status === "awaiting_answers" &&
    Boolean(questions?.questions.some((question) => !question.answer)) &&
    busy !== "answers";

  const audioPlan = useMemo(
    () =>
      production.entities
        .filter((entry) => entry.kind === "audio_segment")
        .map((entry) => entry.current?.data as { id: string; track: string; prompt?: string | null; text?: string | null; shotIds: string[] }),
    [production.entities],
  );

  if (pendingQuestions && questions) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <BackLink href="/productions">Productions</BackLink>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{production.title}</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Questions</CardTitle>
            <CardDescription>These choices would change the video.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {questions.questions.map((question) => (
              <fieldset key={question.id} className="flex flex-col gap-2">
                <legend className="text-sm font-medium">{question.text}</legend>
                <p className="text-xs text-muted-foreground">{question.whyItMatters}</p>
                {question.options.map((option) => (
                  <label key={option} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[question.id] === option}
                      onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
                      className="size-4 accent-primary"
                    />
                    {option}
                  </label>
                ))}
              </fieldset>
            ))}
            {message && (
              <p className="text-sm text-destructive" role="alert">
                {message}
              </p>
            )}
            <Button
              size="lg"
              onClick={() => void handleAnswers()}
              disabled={busy === "answers"}
              className="h-10 rounded-xl px-4 sm:self-start"
            >
              {busy === "answers" && <LoaderCircle className="animate-spin" data-icon="inline-start" aria-hidden />}
              Continue
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <BackLink href="/productions">Productions</BackLink>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">{production.title}</h1>
          {!production.error && (
            <p className="mt-1 text-sm text-muted-foreground">{statusLine(production, estimatedCredits)}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {production.status === "preview" && (
            <Button onClick={() => void handleApprove()} disabled={busy === "approve"}>
              {estimatedCredits ? `Generate · ${estimatedCredits.toLocaleString()} credits` : "Generate"}
            </Button>
          )}
          {production.status === "ready" && (
            <Button
              variant="outline"
              onClick={() => void handleRegenerate()}
              disabled={busy === "regenerate"}
              aria-label="Regenerate video"
            >
              {busy === "regenerate"
                ? "Starting…"
                : estimatedCredits
                  ? `Regenerate · ${estimatedCredits.toLocaleString()} credits`
                  : "Regenerate video"}
            </Button>
          )}
          {production.editProjectId ? (
            <Link href={`/editor/${production.editProjectId}`} className={buttonVariants()} aria-label="Open in editor">
              Open in editor
            </Link>
          ) : production.status === "ready" ? (
            <Button onClick={() => void handleOpenEditor()} disabled={busy === "editor"} aria-label="Open in editor">
              {busy === "editor" ? "Opening…" : "Open in editor"}
            </Button>
          ) : null}
          {isLiveProductionStatus(production.status) && (
            <Button variant="outline" onClick={() => void handleCancel()} disabled={busy === "cancel"}>
              Cancel
            </Button>
          )}
          {production.status === "failed" && !production.error && (
            <Button onClick={() => void handleRetry()} disabled={busy === "retry"}>
              {busy === "retry" ? "Retrying…" : "Retry"}
            </Button>
          )}
        </div>
      </div>

      {production.error && (
        <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-destructive/10 px-3 py-2">
          <p className="text-sm text-destructive" role="alert">
            {production.error}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleRetry()}
            disabled={busy === "retry"}
            aria-label={canceled ? "Start this production again" : "Retry from the last step"}
          >
            {busy === "retry" ? (canceled ? "Starting…" : "Retrying…") : canceled ? "Start again" : "Retry"}
          </Button>
        </div>
      )}
      {message && (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}

      {(production.status === "drafting" || busy === "answers") && (
        <StatusTimeline
          items={planningItemsFromStage(production.stage, production.status)}
          elapsed={elapsed}
          currentLabel={activityLabel(production)}
        />
      )}
      {["generating", "reviewing", "assembling"].includes(production.status) && production.steps.length > 0 && (
        <StatusTimeline
          items={generationItems(production.steps)}
          elapsed={elapsed}
          currentLabel={activityLabel(production)}
        />
      )}

      {references.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reference pictures</CardTitle>
            <CardDescription>Stills for characters, places, and shots are matched to these.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {references.map((picture, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={picture.id}
                src={uploadFileUrl(picture.key)}
                alt={`Reference picture ${index + 1}`}
                className="size-24 rounded-xl border border-border object-cover"
              />
            ))}
          </CardContent>
        </Card>
      )}

      {script && (
        <Card>
          <CardHeader>
            <CardTitle>Script</CardTitle>
            <CardDescription>{script.logline}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {script.scenes.map((scene) => (
              <article key={scene.id} className="rounded-xl bg-muted/40 p-3">
                <h3 className="text-sm font-medium">{scene.heading}</h3>
                <p className="mt-1 text-sm">{scene.action}</p>
                {scene.dialogue.map((line) => (
                  <p key={`${line.speaker}:${line.line}`} className="mt-1 text-sm">
                    <span className="font-medium">{line.speaker}:</span> {line.line}
                  </p>
                ))}
              </article>
            ))}
          </CardContent>
        </Card>
      )}

      {brief && (
        <Card>
          <CardHeader>
            <CardTitle>Visual direction</CardTitle>
            <CardDescription>{brief.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-muted-foreground">Style.</span> {brief.visualStyle}</p>
            <p><span className="text-muted-foreground">Palette.</span> {brief.colorPalette}</p>
            <p><span className="text-muted-foreground">Lighting.</span> {brief.lighting}</p>
            <p><span className="text-muted-foreground">Camera.</span> {brief.cameraBehavior}</p>
            <p><span className="text-muted-foreground">Music.</span> {brief.music}</p>
            <p><span className="text-muted-foreground">Ambience.</span> {brief.ambience}</p>
          </CardContent>
        </Card>
      )}

      {assumptions && (assumptions.assumptions.length > 0 || assumptions.proposedAdditions.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Assumptions</CardTitle>
            <CardDescription>Inferred details and invented story choices stay visible.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {assumptions.assumptions.map((item) => (
              <p key={item.id}>{item.text}</p>
            ))}
            {assumptions.proposedAdditions.map((item) => (
              <p key={item.id} className="rounded-lg bg-amber-400/10 px-2 py-1">
                Proposed: {item.text}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {shots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Shot plan</CardTitle>
            <CardDescription>{shots.length} shots</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {shots
              .slice()
              .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
              .map((shot) =>
                shot ? (
                  <div key={shot.id} className="rounded-xl border border-border p-3 text-sm">
                    <p className="font-medium">
                      {shot.id} · {shot.continuity} · {shot.editDurationSec}s · {shot.speechMode}
                    </p>
                    <p className="mt-1 text-muted-foreground">{shot.action}</p>
                  </div>
                ) : null,
              )}
          </CardContent>
        </Card>
      )}

      {audioPlan.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Audio</CardTitle>
            <CardDescription>Dialogue, music, and ambience can span visual cuts.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            {audioPlan.map((segment) => (
              <p key={segment.id}>
                <span className="font-medium">{segment.track}</span>
                {segment.text ? ` — ${segment.text}` : segment.prompt ? ` — ${segment.prompt}` : ""} across {segment.shotIds.join(", ")}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {production.steps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>
              {activityLabel(production)} · {doneSteps}/{production.steps.length} complete
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {production.steps.map((step) => {
              const running = step.status === "leased" || step.status === "waiting_provider";
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm",
                    running && "font-medium",
                    step.status === "failed" && "bg-destructive/10 text-destructive",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {running && <LoaderCircle className="size-3.5 animate-spin text-primary" aria-hidden />}
                    {STEP_KIND_LABEL[step.kind] ?? step.kind} · {prettyTarget(step.targetKey)} · {STEP_STATUS_LABEL[step.status]}
                    {step.error ? ` — ${step.error}` : ""}
                  </span>
                  {(step.status === "failed" || step.status === "canceled" || step.status === "blocked") && (
                    <Button size="sm" variant="outline" onClick={() => void handleRetry(step.id)} disabled={busy === step.id}>
                      {step.error === REVIEW_REJECTED ? "Regenerate shot" : "Retry"}
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <UpgradeDialog
        open={upgrade !== null}
        required={upgrade?.required ?? 0}
        balance={upgrade?.balance ?? 0}
        onClose={() => setUpgrade(null)}
      />
      <details className="rounded-2xl border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Advanced settings</summary>
        <div className="mt-3 flex flex-col gap-2 text-muted-foreground">
          <p>Planner: {production.plannerProvider}</p>
          <p>Mode: {production.mode}{production.creativeDelegation ? " (delegated)" : ""}</p>
          {requirements && <p>Exact dialogue lines: {requirements.exactDialogue.length}</p>}
          <label className="mt-2 flex flex-col gap-1 text-foreground">
            Edit script JSON
            <Textarea
              className="font-mono text-xs"
              defaultValue={JSON.stringify(script ?? {}, null, 2)}
              aria-label="Script JSON"
              onBlur={(event) => {
                try {
                  const data = JSON.parse(event.target.value) as Script;
                  void updateProductionEntity({ id: production.id, kind: "script", stableKey: "script", data });
                } catch {
                  setMessage("Script JSON is invalid.");
                }
              }}
            />
          </label>
        </div>
      </details>
    </div>
  );
}
