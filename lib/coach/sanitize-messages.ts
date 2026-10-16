import type { UIMessage } from "ai";

/**
 * These states reject `output`. A client tool handler can attach `{ skipped: true }`
 * before an approval request lands, and the SDK keeps that field when the part
 * moves to `approval-responded`. Validation then rejects the whole turn.
 */
const STATES_WITHOUT_OUTPUT = new Set([
  "input-streaming",
  "input-available",
  "approval-requested",
  "approval-responded",
  "output-denied",
  "output-error",
]);

const isToolPart = (part: UIMessage["parts"][number]) =>
  part.type === "dynamic-tool" || part.type.startsWith("tool-");

const omitFields = (part: UIMessage["parts"][number], fields: readonly string[]) => {
  const next: Record<string, unknown> = { ...part };
  for (const field of fields) delete next[field];
  return next as UIMessage["parts"][number];
};

const sanitizePart = (part: UIMessage["parts"][number]): UIMessage["parts"][number] => {
  if (!isToolPart(part) || !("state" in part) || typeof part.state !== "string") return part;
  if (!STATES_WITHOUT_OUTPUT.has(part.state)) return part;

  const dropOutput = "output" in part && part.output !== undefined;
  const dropErrorText = part.state !== "output-error" && "errorText" in part && part.errorText !== undefined;
  if (!dropOutput && !dropErrorText) return part;

  const fields = [...(dropOutput ? ["output"] : []), ...(dropErrorText ? ["errorText"] : [])];
  return omitFields(part, fields);
};

export const sanitizeCoachMessages = (messages: readonly UIMessage[]): UIMessage[] =>
  messages.map((message) => ({
    ...message,
    parts: message.parts.map(sanitizePart),
  }));
