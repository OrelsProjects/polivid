import "server-only";

const POLL_MS = 3000;

export const sleep = () => new Promise((resolve) => setTimeout(resolve, POLL_MS));

export class FootageStopped extends Error {
  constructor() {
    super("Stopped.");
    this.name = "FootageStopped";
  }
}

/** The model answered that this clip will not be made. Silence is not this. */
export class ModelDeclined extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelDeclined";
  }
}

/** A database error inside `shouldContinue` does not cancel the wait. */
export const stopIfCanceled = async (shouldContinue: () => Promise<boolean>) => {
  try {
    if (!(await shouldContinue())) throw new FootageStopped();
  } catch (error) {
    if (error instanceof FootageStopped) throw error;
  }
};

/** Logs the first miss and every tenth after it, so a long wait does not flood the log. */
export const logMiss = (misses: number, message: string, error: unknown) => {
  if (misses === 1 || misses % 10 === 0) console.error(message, causeText(error));
};

export const isRetryableStatus = (status: number) => status === 408 || status === 429 || status >= 500;

export const checkVideoBytes = (bytes: Uint8Array) => {
  if (bytes.byteLength < 1000) throw new Error("The video model returned an empty file.");
  return bytes;
};

const causeText = (error: unknown) => {
  if (!(error instanceof Error)) return "No reply";
  const cause = error.cause;
  return cause instanceof Error && cause.message ? cause.message : error.message;
};

export const errorMessage = async (response: Response) => {
  const text = await response.text();
  return messageFrom(parseJson(text)) || text.slice(0, 300) || `Video request failed (${response.status}).`;
};

const parseJson = (text: string) => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

export const messageFrom = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const record = value as { message?: unknown; error?: unknown };
  return messageFrom(record.message) ?? messageFrom(record.error);
};
