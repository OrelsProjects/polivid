import { proseWithoutRunWildNote } from "./run-wild-notes";
import { proseWithoutVoiceNote } from "./voice-notes";

/** Pictures that take the suggested look. They wait until the person confirms a preset. */
export const HELD_IMAGE_TOOLS = ["make_storyboard", "generate_image"] as const;

export const LOOK_CONFIRM_ERROR =
  "The look is not confirmed. Stop. The person confirms it on the preset card. Do not generate pictures until their message names the look.";

/** The line the confirm button sends. The id is the rest of the line. */
export const CONFIRMED_LOOK_PREFIX = "Confirmed look:";

export const confirmedLookMessage = (presetId: string) => `${CONFIRMED_LOOK_PREFIX} ${presetId.trim()}`;

export const confirmedLookFromText = (text: string) => {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(CONFIRMED_LOOK_PREFIX)) continue;
    return trimmed.slice(CONFIRMED_LOOK_PREFIX.length).trim();
  }
  return "";
};

type Part = {
  type?: string;
  state?: string;
  output?: unknown;
  text?: string;
};

const presetIdOf = (output: unknown) => {
  if (!output || typeof output !== "object" || !("preset" in output)) return "";
  const preset = (output as { preset?: { id?: unknown } }).preset;
  return preset && typeof preset.id === "string" ? preset.id.trim() : "";
};

/** The preset id the person confirmed. Empty when the output is not a confirmation. */
export const presetIdFromConfirm = (output: unknown) => {
  if (typeof output === "string") return output.trim();
  if (output && typeof output === "object" && "presetId" in output && typeof (output as { presetId?: unknown }).presetId === "string") {
    return (output as { presetId: string }).presetId.trim();
  }
  return "";
};

const confirmedFromPart = (message: { role?: string }, part: Part) => {
  if (part.type === "tool-app_confirm_preset" && part.state === "output-available") return presetIdFromConfirm(part.output);
  if (message.role === "user" && part.type === "text" && part.text) return confirmedLookFromText(part.text);
  return "";
};

/**
 * True when suggest_preset returned a look and the person has not confirmed one since.
 * A later suggestion waits again.
 */
export const presetConfirmationPending = (messages: readonly { role?: string; parts?: readonly Part[] }[]) => {
  let pending = false;
  for (const message of messages) {
    for (const part of message.parts ?? []) {
      if (part.type === "tool-suggest_preset" && part.state === "output-available" && presetIdOf(part.output)) {
        pending = true;
      }
      if (confirmedFromPart(message, part)) pending = false;
    }
  }
  return pending;
};

/** The preset id that confirmed this message's suggestion. Empty while the card is still waiting. */
export const confirmedLookForMessage = (
  messages: readonly { role?: string; parts?: readonly Part[] }[],
  messageIndex: number,
) => {
  let armed = false;
  for (let index = messageIndex; index < messages.length; index += 1) {
    const message = messages[index];
    if (!message) continue;
    for (const part of message.parts ?? []) {
      const suggested = part.type === "tool-suggest_preset" && part.state === "output-available" && presetIdOf(part.output);
      if (index === messageIndex && suggested && !armed) {
        armed = true;
        continue;
      }
      if (!armed) continue;
      if (suggested) return "";
      const confirmed = confirmedFromPart(message, part);
      if (confirmed) return confirmed;
    }
  }
  return "";
};

/** The confirm button's message. It is for the model, not a line to show in the chat. */
export const isLookConfirmationMessage = (message: {
  role: string;
  parts: readonly { type: string; text?: string }[];
}) =>
  message.role === "user" &&
  message.parts.length > 0 &&
  message.parts.every((part) => {
    if (part.type !== "text" || !part.text) return false;
    const prose = proseWithoutRunWildNote(proseWithoutVoiceNote(part.text)).trim();
    if (!prose) return true;
    const id = confirmedLookFromText(prose);
    return Boolean(id) && prose === confirmedLookMessage(id);
  });

/** True when this turn already suggested a look and the person has not confirmed it yet. */
export const lookSuggestedInSteps = (
  steps: readonly { toolResults?: readonly { toolName?: string; output?: unknown }[] }[],
) => {
  let suggested = false;
  for (const step of steps) {
    for (const result of step.toolResults ?? []) {
      if (result.toolName === "suggest_preset" && presetIdOf(result.output)) suggested = true;
      if (result.toolName === "app_confirm_preset" && presetIdFromConfirm(result.output)) suggested = false;
    }
  }
  return suggested;
};

export const withoutHeldImageTools = (names: readonly string[]) =>
  names.filter((name) => !(HELD_IMAGE_TOOLS as readonly string[]).includes(name));

/** A picture tool called in the same step as suggest_preset has to wait. */
export const imageToolBlockedByLook = (toolName: string, suggested: boolean) =>
  suggested && (HELD_IMAGE_TOOLS as readonly string[]).includes(toolName);
