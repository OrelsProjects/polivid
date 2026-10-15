const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

export interface SpeechCheck {
  ok: boolean;
  intended: string;
  observed: string;
  confidence: number;
  uncertain: boolean;
}

export const compareTranscript = (intended: string, observed: string, confidence: number, minConfidence = 0.7): SpeechCheck => {
  const left = normalize(intended);
  const right = normalize(observed);
  const uncertain = confidence < minConfidence;
  if (uncertain) {
    return { ok: false, intended, observed, confidence, uncertain: true };
  }
  return { ok: left === right || right.includes(left) || left.includes(right), intended, observed, confidence, uncertain: false };
};

export const alignmentDoesNotVerifyWords = true;
