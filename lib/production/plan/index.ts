import type { Planner } from "../planner";
import { DEVELOP_INSTRUCTIONS, formatDevelopInput, formatStructureInput, STRUCTURE_INSTRUCTIONS } from "../prompts";
import { DevelopOutputSchema, StructureOutputSchema, type DevelopOutput, type StructureOutput } from "../schema";
import { normalizeContinuity, validateDevelop, validateStructure, type ValidationResult } from "../validate";

export interface PlanContext {
  text: string;
  format: string;
  durationSec: number;
  language: string;
  answers?: Record<string, string>;
  delegated: boolean;
  styleLock?: string | null;
}

export const runDevelopPass = async (planner: Planner, context: PlanContext) => {
  const result = await planner.run({
    task: "develop",
    schema: DevelopOutputSchema,
    system: DEVELOP_INSTRUCTIONS,
    input: formatDevelopInput(context),
  });
  const validation = validateDevelop(result.output);
  return { develop: result.output, validation, usage: result.usage, model: result.model };
};

export const runStructurePass = async (
  planner: Planner,
  develop: DevelopOutput,
  options: { retryNotes?: string | null } = {},
) => {
  const result = await planner.run({
    task: "structure",
    schema: StructureOutputSchema,
    system: STRUCTURE_INSTRUCTIONS,
    input: formatStructureInput({ developJson: JSON.stringify(develop), retryNotes: options.retryNotes }),
  });
  const structure = normalizeContinuity(result.output);
  const validation = validateStructure(develop, structure);
  return { structure, validation, usage: result.usage, model: result.model };
};

export const needsUserQuestions = (develop: DevelopOutput, delegated: boolean) => {
  if (delegated) return false;
  return develop.questions.questions.some((question) => !question.answer);
};

export const applyAnswers = (develop: DevelopOutput, answers: Record<string, string>): DevelopOutput => ({
  ...develop,
  questions: {
    questions: develop.questions.questions.map((question) => ({
      ...question,
      answer: answers[question.id] ?? question.answer,
    })),
  },
});

export type { StructureOutput, ValidationResult };
