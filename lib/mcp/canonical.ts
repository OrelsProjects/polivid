import { createHash } from "node:crypto";

/** The optional field MCP adds to every tool that needs a confirmation. */
export const CONFIRM_FIELD = "confirmToken";

/** JSON with sorted keys and no undefined values, so the same input always hashes the same. */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
};

/** Split the confirm token off a tool call's arguments. */
export const splitConfirmToken = (args: unknown) => {
  if (!args || typeof args !== "object" || Array.isArray(args)) return { input: args ?? {}, confirmToken: "" };
  const { [CONFIRM_FIELD]: token, ...input } = args as Record<string, unknown>;
  return { input, confirmToken: typeof token === "string" ? token.trim() : "" };
};

/** Hash of the tool name and its input, without the confirm token. A quote only redeems for the exact same call. */
export const callHash = (toolName: string, input: unknown) =>
  createHash("sha256").update(`${toolName}\n${canonicalJson(input)}`).digest("hex");
