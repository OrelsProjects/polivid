export { DEVELOP_INSTRUCTIONS } from "./develop";
export { STRUCTURE_INSTRUCTIONS } from "./structure";

export const formatDevelopInput = (args: {
  text: string;
  format: string;
  durationSec: number;
  language: string;
  answers?: Record<string, string>;
  delegated: boolean;
  styleLock?: string | null;
}) => {
  const answers =
    args.answers && Object.keys(args.answers).length > 0
      ? `\n\nUser answers:\n${Object.entries(args.answers)
          .map(([id, answer]) => `- ${id}: ${answer}`)
          .join("\n")}`
      : "";
  const lock = args.styleLock?.trim()
    ? `\n\nSTYLE LOCK — reuse this wording in the creative brief and every shot:\n${args.styleLock.trim()}`
    : "";
  return `Format: ${args.format}
Target duration: ${args.durationSec} seconds
Language: ${args.language}
Creative delegation: ${args.delegated ? "yes — do not ask questions" : "no"}

User request:
${args.text}${answers}${lock}`;
};

export const formatStructureInput = (args: { developJson: string; retryNotes?: string | null }) => {
  const retry = args.retryNotes?.trim()
    ? `\n\nThe previous shot plan failed these checks. Fix every one:\n${args.retryNotes.trim()}`
    : "";
  return `Create the shot plan, sound plan, and production records from this accepted development:\n${args.developJson}${retry}`;
};
