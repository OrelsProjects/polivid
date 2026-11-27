/**
 * Taking something from another page into a new Coach chat: the page leaves the words for the
 * message box (and the character to attach) in this tab's session storage, and the Coach page picks
 * them up once when it opens. Nothing is sent until the person presses send.
 */

const KEY = "polivid:coach-handoff";
/** A handoff older than this is ignored, so a stale one never fills a later chat. */
const FRESH_MS = 10 * 60 * 1000;

export interface CoachHandoff {
  text: string;
  characterId?: string;
  characterName?: string;
}

export const saveCoachHandoff = (handoff: CoachHandoff) => {
  window.sessionStorage.setItem(KEY, JSON.stringify({ ...handoff, at: Date.now() }));
};

/** The waiting handoff, once: reading it takes it away. */
export const takeCoachHandoff = (now = Date.now()): CoachHandoff | null => {
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(KEY);
  try {
    const value = JSON.parse(raw) as Partial<CoachHandoff> & { at?: number };
    if (typeof value.text !== "string" || !value.text.trim() || typeof value.at !== "number" || now - value.at > FRESH_MS) return null;
    return {
      text: value.text,
      ...(typeof value.characterId === "string" ? { characterId: value.characterId } : {}),
      ...(typeof value.characterName === "string" ? { characterName: value.characterName } : {}),
    };
  } catch {
    return null;
  }
};

/**
 * A skit's plan as a message to talk over with the Coach: the script, the settings it was planned
 * with, and every shot. It ends ready for the person's own question.
 */
export const skitPlanForChat = (input: {
  script: string;
  look: string;
  quality: string;
  seconds: number;
  credits: number;
  /** Whether each shot runs on from the last one. */
  smooth: boolean;
  shots: readonly { say: string; shot: string; seconds: number; sound: string; hold?: number }[];
}) =>
  [
    "Let's go over this skit plan before it's filmed. When we agree, film it with make_skit_video using this script and these shots as skitPlan.",
    "",
    "Script:",
    input.script.trim(),
    "",
    `Plan: ${input.look} · ${input.quality} quality · about ${input.seconds} seconds (the voice sets the exact length) · ${input.credits.toLocaleString()} credits · smooth transitions ${input.smooth ? "on" : "off"}`,
    ...input.shots.flatMap((shot, index) => [
      `${index + 1}. ${shot.seconds}s · ${shot.sound.trim() ? `sound: ${shot.sound.trim()}` : "no sound"}${shot.hold ? ` · holds ${shot.hold}s after the line` : ""}`,
      `   Line: ${shot.say.trim()}`,
      `   Shot: ${shot.shot.trim()}`,
    ]),
    "",
    "My question: ",
  ].join("\n");
