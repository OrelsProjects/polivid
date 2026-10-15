import type { Observation, ReviewFinding, Shot } from "../schema";
import { compareTranscript } from "./speech";

export { checkMediaFile, extractBoundaryFrames, measureLoudness, probeFile, timelineDuration } from "./ffmpeg";
export { compareTranscript } from "./speech";

export interface ReviewInput {
  shot: Shot;
  intendedSpeech?: string | null;
  transcript?: { text: string; confidence: number } | null;
  findings: ReviewFinding[];
  observation: Observation;
}

export const shouldRepair = (input: ReviewInput, remainingAttempts: number, remainingBudget: number) => {
  if (remainingAttempts <= 0 || remainingBudget <= 0) return false;
  if (input.findings.some((finding) => finding.severity === "error")) return true;
  if (input.intendedSpeech && input.transcript) {
    const check = compareTranscript(input.intendedSpeech, input.transcript.text, input.transcript.confidence);
    if (!check.ok && !check.uncertain) return true;
  }
  return false;
};
