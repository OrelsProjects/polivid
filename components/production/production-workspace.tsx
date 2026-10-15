"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
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
  const [production, setProduction] = useState(initial);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<{ required: number; balance: number } | null>(null);
  const [estimatedCredits, setEstimatedCredits] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

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

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      void refresh();
      setNow(Date.now());
    }, 1500);
    return () => clearInterval(timer);
  }, [live, production.id]);

  const refresh = async () => {
    const response = await fetch(`/api/productions/${production.id}`);
    const json = (await response.json()) as { production?: ProductionView };
    if (json.production) setProduction(json.production);
  };

  const handleAnswers = async () => {
    setBusy("answers");
    setMessage(null);
    setProduction((current) => ({
      ...current,
      status: "drafting",
      stage: "develop",
      runStartedAt: new Date().toISOString(),
    }));
    const response = await fetch(`/api/productions/${production.id}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) setMessage(json.error ?? "Couldn't save those answers.");
    await refresh();
    setBusy(null);
  };

  useEffect(() => {
    if (production.status !== "preview" && production.status !== "ready") return;
    const loadEstimate = async () => {
      const response = await fetch("/api/billing/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "production", productionId: production.id }),
      });
      const json = (await response.json().catch(() => null)) as { credits?: number } | null;
      if (response.ok && typeof json?.credits === "number") setEstimatedCredits(json.credits);
    };
    void loadEstimate();
  }, [production.id, production.status]);

  const handleApprove = async () => {
    setBusy("approve");
    const response = await fetch(`/api/productions/${production.id}/approve`, { method: "POST" });
    if (!response.ok) {
      const json = (await response.json()) as {
        error?: string;
        code?: string;
        required?: number;
        balance?: number;
      };
      if (response.status === 402 && json.code === "insufficient_credits") {
        setUpgrade({ required: json.required ?? 0, balance: json.balance ?? 0 });
      } else {
        setMessage(json.error ?? "Couldn't start generation.");
      }
    }
    await refresh();
    setBusy(null);
  };

  const handleRegenerate = async () => {
    setBusy("regenerate");
    setMessage(null);
    const response = await fetch(`/api/productions/${production.id}/regenerate`, { method: "POST" });
    const json = (await response.json()) as {
      error?: string;
      code?: string;
      required?: number;
      balance?: number;
      id?: string;
    };
    if (!response.ok) {
      if (response.status === 402 && json.code === "insufficient_credits") {
        setUpgrade({ required: json.required ?? 0, balance: json.balance ?? 0 });
      } else {
        setMessage(json.error ?? "Couldn't regenerate this video.");
      }
      setBusy(null);
      return;
    }
    if (json.id) {
      router.push(`/productions/${json.id}`);
      return;
    }
    await refresh();
    setBusy(null);
  };

  const handleCancel = async () => {
    setBusy("cancel");
    await fetch(`/api/productions/${production.id}/cancel`, { method: "POST" });
    await refresh();
    setBusy(null);
  };

  const handleOpenEditor = async () => {
    if (production.editProjectId) {
      router.push(`/editor/${production.editProjectId}`);
      return;
    }
    setBusy("editor");
    setMessage(null);
    const response = await fetch(`/api/productions/${production.id}/editor`, { method: "POST" });
    const json = (await response.json().catch(() => null)) as { project?: { id: string }; error?: string } | null;
    if (!response.ok || !json?.project?.id) {
      setMessage(json?.error ?? "Couldn't open this in the editor.");
      setBusy(null);
      return;
    }
    setProduction((current) => ({ ...current, editProjectId: json.project!.id }));
    router.push(`/editor/${json.project.id}`);
    setBusy(null);
  };

  const handleRetry = async (stepId?: string) => {
    setBusy(stepId ?? "retry");
    setMessage(null);
    if (!stepId) {
      setProduction((current) => ({
        ...current,
        status: current.steps.some((step) => step.status === "failed" || step.status === "canceled")
          ? "generating"
          : "drafting",
        error: null,
      }));
    }
    const response = await fetch(`/api/productions/${production.id}/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stepId ? { stepId } : {}),
    });
    const json = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) setMessage(json?.error ?? "Couldn't retry from the last step.");
    await refresh();
    setBusy(null);
  };

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
          <Link href="/productions" className="text-sm text-muted-foreground hover:text-foreground">
            Productions
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{production.title}</h1>
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
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[question.id] === option}
                      onChange={() => setAnswers((current) => ({ ...current, [question.id]: option }))}
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
            <Button onClick={() => void handleAnswers()} disabled={busy === "answers"}>
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
        <div>
          <Link href="/productions" className="text-sm text-muted-foreground hover:text-foreground">
            Productions
          </Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{production.title}</h1>
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
            aria-label="Retry from the last step"
          >
            {busy === "retry" ? "Retrying…" : "Retry"}
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
              <p key={item.id} className="rounded-lg bg-amber-50 px-2 py-1">
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
                      Retry
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
      <details className="rounded-2xl border border-border bg-white p-4 text-sm">
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
                  void fetch(`/api/productions/${production.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kind: "script", stableKey: "script", data }),
                  }).then(() => refresh());
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
