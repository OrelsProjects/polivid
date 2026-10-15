import type {
  DevelopOutput,
  ExactDialogue,
  ProductionPlan,
  StructureOutput,
  ValidationIssue,
} from "./types";

export type { ValidationIssue } from "./types";

const WORDS_PER_SEC = 2.4;

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

const issue = (
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  path?: string,
): ValidationIssue => ({ severity, code, message, path });

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export const validateDevelop = (develop: DevelopOutput): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const { requirements, script, durationFit } = develop;

  for (const line of requirements.exactDialogue) {
    if (!scriptHasDialogue(script, line)) {
      issues.push(issue("error", "dialogue_missing", `Exact dialogue is missing: "${line.speaker}: ${line.line}"`));
    }
  }

  for (const event of requirements.requiredEvents) {
    const haystack = script.scenes.map((scene) => `${scene.action} ${scene.change} ${scene.heading}`).join(" ");
    if (!normalize(haystack).includes(normalize(event.description).slice(0, 24)) && event.description.length > 8) {
      const found = script.scenes.some((scene) =>
        normalize(`${scene.action} ${scene.change}`).includes(normalize(event.description).slice(0, 12)),
      );
      if (!found) {
        issues.push(issue("warn", "event_unmapped", `Required event may be missing: ${event.description}`, event.id));
      }
    }
  }

  if (requirements.ending.provenance === "explicit") {
    const last = script.scenes.at(-1);
    if (last && !normalize(`${last.action} ${last.change}`).includes(normalize(requirements.ending.value).slice(0, 16))) {
      issues.push(issue("warn", "ending_drift", "The script ending may not match the specified ending."));
    }
  }

  const spokenSec = script.scenes.reduce((sum, scene) => {
    const words = scene.dialogue.reduce((count, line) => count + line.line.split(/\s+/).filter(Boolean).length, 0);
    return sum + words / WORDS_PER_SEC + 2;
  }, 0);
  const estimated = Math.max(develop.durationFit.estimatedSec, spokenSec + script.scenes.length * 1.5);
  if (estimated > requirements.durationSec.value * 1.15 && durationFit.fits) {
    issues.push(
      issue(
        "error",
        "duration_overflow",
        `The story needs about ${Math.round(estimated)}s but the target is ${requirements.durationSec.value}s. Propose a shorter treatment or a longer duration.`,
      ),
    );
  }

  for (const scene of script.scenes) {
    if (!scene.who.length) issues.push(issue("error", "scene_who", "Scene is missing who is present.", scene.id));
    if (!scene.where) issues.push(issue("error", "scene_where", "Scene is missing where it happens.", scene.id));
    if (!scene.action) issues.push(issue("error", "scene_action", "Scene is missing observable action.", scene.id));
  }

  return { ok: issues.every((entry) => entry.severity !== "error"), issues };
};

const scriptHasDialogue = (script: DevelopOutput["script"], line: ExactDialogue) =>
  script.scenes.some((scene) =>
    scene.dialogue.some((spoken) => spoken.line.trim() === line.line.trim() && (!line.speaker || spoken.speaker === line.speaker)),
  );

export const validateStructure = (develop: DevelopOutput, structure: StructureOutput): ValidationResult => {
  const issues: ValidationIssue[] = [];
  const characters = new Set(structure.characters.map((item) => item.id));
  const locations = new Set(structure.locations.map((item) => item.id));
  const scenes = new Set(structure.scenes.map((item) => item.id));
  const shots = new Map(structure.shots.map((item) => [item.id, item]));
  const audio = new Map(structure.audioSegments.map((item) => [item.id, item]));

  for (const scene of structure.scenes) {
    if (!locations.has(scene.locationId)) {
      issues.push(issue("error", "unknown_location", `Scene ${scene.id} references missing location ${scene.locationId}.`));
    }
    for (const id of scene.characterIds) {
      if (!characters.has(id)) issues.push(issue("error", "unknown_character", `Scene ${scene.id} references missing character ${id}.`));
    }
  }

  const ordered = [...structure.shots].sort((a, b) => a.order - b.order);
  for (const [index, shot] of ordered.entries()) {
    if (!scenes.has(shot.sceneId)) {
      issues.push(issue("error", "unknown_scene", `Shot ${shot.id} references missing scene ${shot.sceneId}.`));
    }
    if (shot.dependsOn && !shots.has(shot.dependsOn)) {
      issues.push(issue("error", "unknown_dependency", `Shot ${shot.id} depends on missing shot ${shot.dependsOn}.`));
    }
    if (shot.continuity === "continue_shot" && !shot.dependsOn) {
      issues.push(issue("error", "continue_without_parent", `Shot ${shot.id} continues a view but has no predecessor.`));
    }
    if (shot.continuity === "new_angle" && index > 0) {
      const parent = shot.dependsOn ? shots.get(shot.dependsOn) : ordered[index - 1];
      if (parent && parent.sceneId !== shot.sceneId) {
        issues.push(issue("error", "angle_scene_mismatch", `Shot ${shot.id} is a new angle in a different scene.`));
      }
    }
    for (const id of shot.audioSegmentIds) {
      if (!audio.has(id)) issues.push(issue("error", "unknown_audio", `Shot ${shot.id} references missing audio ${id}.`));
    }
    for (const line of develop.requirements.exactDialogue) {
      if (shot.speechMode === "lipsync" || shot.speechMode === "native" || shot.speechMode === "offscreen") continue;
    }
  }

  for (const line of develop.requirements.exactDialogue) {
    const spoken = structure.audioSegments.some((segment) => segment.text?.trim() === line.line.trim());
    const inScript = develop.script.scenes.some((scene) => scene.dialogue.some((entry) => entry.line.trim() === line.line.trim()));
    if (!spoken && !inScript) {
      issues.push(issue("error", "dialogue_lost", `Exact dialogue is not in the audio plan: "${line.line}"`));
    }
  }

  for (const segment of structure.audioSegments) {
    for (const shotId of segment.shotIds) {
      if (!shots.has(shotId)) issues.push(issue("error", "audio_shot_missing", `Audio ${segment.id} spans missing shot ${shotId}.`));
    }
    if (segment.track === "dialogue" || segment.track === "narration") {
      const host = shots.get(segment.shotIds[0]);
      if (host && segment.durationSec > host.editDurationSec + 0.35) {
        issues.push(
          issue(
            "error",
            "speech_overflow",
            `Speech ${segment.id} (${segment.durationSec}s) does not fit shot ${host.id} (${host.editDurationSec}s).`,
          ),
        );
      }
    }
  }

  const visualSec = ordered.reduce((sum, shot) => sum + shot.editDurationSec, 0);
  if (visualSec > develop.requirements.durationSec.value * 1.2) {
    issues.push(
      issue("error", "timeline_overflow", `Shots total ${visualSec.toFixed(1)}s, over the ${develop.requirements.durationSec.value}s target.`),
    );
  }

  return { ok: issues.every((entry) => entry.severity !== "error"), issues };
};

export const validatePlan = (plan: ProductionPlan): ValidationResult => {
  const first = validateDevelop(plan.develop);
  if (!plan.structure) return first;
  const second = validateStructure(plan.develop, plan.structure);
  const issues = [...first.issues, ...second.issues];
  return { ok: issues.every((entry) => entry.severity !== "error"), issues };
};
