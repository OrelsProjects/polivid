import { proseWithoutVoiceNote } from "@/lib/coach/voice-notes";

/** One line on a user message when the composer toggle is on. */
export const RUN_WILD_NOTE = "Run wild: on";

/** The answer a Just make it button sends. The Coach treats it as a go-ahead. */
export const JUST_MAKE_IT_TEXT = "Just make it. Pick everything yourself and queue it now.";

export const runWildNote = () => RUN_WILD_NOTE;

export const hasRunWildNote = (text: string) => text.split("\n").some((line) => line.trim() === RUN_WILD_NOTE);

export const proseWithoutRunWildNote = (text: string) =>
  text
    .split("\n")
    .filter((line) => line.trim() !== RUN_WILD_NOTE)
    .join("\n")
    .trim();

const textOf = (part: { type: string; text?: string }) => (part.type === "text" && part.text ? part.text : "");

const justMakeItProse = (text: string) => proseWithoutRunWildNote(proseWithoutVoiceNote(text)).trim() === JUST_MAKE_IT_TEXT;

const toolAnsweredJustMakeIt = (part: { type: string; output?: unknown }) =>
  part.type.startsWith("tool-") && part.output === JUST_MAKE_IT_TEXT;

/**
 * True when this turn should skip questions and the storyboard.
 * A Run wild note or a Just make it answer counts. A later user message without either turns it off.
 */
export const runWildFromMessages = (
  messages: readonly { role: string; parts: readonly { type: string; text?: string; output?: unknown }[] }[],
) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    if (message.role === "user") {
      return message.parts.some((part) => {
        const text = textOf(part);
        return Boolean(text) && (hasRunWildNote(text) || justMakeItProse(text));
      });
    }
    if (message.role === "assistant" && message.parts.some((part) => toolAnsweredJustMakeIt(part))) return true;
  }
  return false;
};
