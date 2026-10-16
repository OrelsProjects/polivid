import { isCharacterId, OFF_VOICE_ID, STUDIO_VOICE_ID } from "@/lib/voice/constants";

export const VOICE_NOTE_PREFIX = "Attached character:";
const LEGACY_PREFIX = "Attached voice:";
const PREFIXES = [VOICE_NOTE_PREFIX, LEGACY_PREFIX] as const;

const prefixOf = (line: string) => PREFIXES.find((prefix) => line.startsWith(prefix));

/** One line naming the chosen character. The name after the id is only for display. */
export const voiceNote = (characterId: string, name = "") => {
  const id = isCharacterId(characterId) ? characterId : OFF_VOICE_ID;
  const label = name.replace(/\s+/g, " ").trim();
  return `${VOICE_NOTE_PREFIX} ${id}${label ? ` ${label}` : ""}`;
};

const noteLine = (text: string) => {
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const prefix = prefixOf(line);
    if (prefix) return line.slice(prefix.length).trim();
  }
  return null;
};

export const voiceFromNote = (text: string) => {
  const rest = noteLine(text);
  if (!rest) return "";
  const id = rest.split(/\s+/)[0] ?? "";
  return isCharacterId(id) ? id : "";
};

const nameFromNote = (text: string) => {
  const rest = noteLine(text);
  if (!rest) return "";
  return rest.split(/\s+/).slice(1).join(" ");
};

export const proseWithoutVoiceNote = (text: string) =>
  text
    .split("\n")
    .filter((line) => !prefixOf(line.trim()))
    .join("\n")
    .trim();

/** The latest attached character in the chat. An explicit off replaces an earlier choice. */
export const voiceFromMessages = (
  messages: readonly { role: string; parts: readonly { type: string; text?: string }[] }[],
) => {
  let voice = "";
  for (const message of messages) {
    if (message.role !== "user") continue;
    for (const part of message.parts) {
      if (part.type !== "text" || !part.text) continue;
      const next = voiceFromNote(part.text);
      if (next) voice = next;
    }
  }
  return voice;
};

/** What the chat bubble shows for the note in this text, or an empty string. */
export const voiceChoiceLabel = (text: string) => {
  const id = voiceFromNote(text);
  if (id === STUDIO_VOICE_ID) return "Studio narrator";
  if (!id || id === OFF_VOICE_ID) return "";
  return nameFromNote(text) || "Saved character";
};
