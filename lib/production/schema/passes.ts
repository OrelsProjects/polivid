import { z } from "zod";
import { INPUT_CLASSES } from "./enums";
import {
  AssumptionsRecordSchema,
  AudioSegmentSchema,
  CharacterSchema,
  CreativeBriefSchema,
  LocationSchema,
  PropSchema,
  QuestionsRecordSchema,
  RequirementsSchema,
  SceneRecordSchema,
  ScriptSchema,
  ShotSchema,
  VoiceRecordSchema,
} from "./entities";

export const DevelopOutputSchema = z.object({
  classification: z.enum(INPUT_CLASSES),
  requirements: RequirementsSchema,
  assumptions: AssumptionsRecordSchema,
  questions: QuestionsRecordSchema,
  brief: CreativeBriefSchema,
  script: ScriptSchema,
  durationFit: z.object({
    estimatedSec: z.number().positive(),
    targetSec: z.number().positive(),
    fits: z.boolean(),
    proposal: z.string().nullable(),
  }),
});
export type DevelopOutput = z.infer<typeof DevelopOutputSchema>;

export const StructureOutputSchema = z.object({
  characters: z.array(CharacterSchema),
  locations: z.array(LocationSchema),
  props: z.array(PropSchema),
  scenes: z.array(SceneRecordSchema).min(1),
  shots: z.array(ShotSchema).min(1),
  audioSegments: z.array(AudioSegmentSchema),
  voices: z.array(VoiceRecordSchema),
});
export type StructureOutput = z.infer<typeof StructureOutputSchema>;

export const ProductionPlanSchema = z.object({
  develop: DevelopOutputSchema,
  structure: StructureOutputSchema.nullable(),
});
export type ProductionPlan = z.infer<typeof ProductionPlanSchema>;
