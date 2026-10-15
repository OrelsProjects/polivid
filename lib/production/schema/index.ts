export * from "./enums";
export * from "./entities";
export * from "./passes";

import { z } from "zod";
import { ENTITY_KINDS, type EntityKind } from "./enums";
import {
  AssumptionsRecordSchema,
  AudioSegmentSchema,
  CharacterSchema,
  CreativeBriefSchema,
  InputRecordSchema,
  LocationSchema,
  ObservationSchema,
  ProductionTimelineSchema,
  PropSchema,
  QuestionsRecordSchema,
  RequirementsSchema,
  ReviewRecordSchema,
  SceneRecordSchema,
  ScriptSchema,
  ShotSchema,
  VoiceRecordSchema,
} from "./entities";

export const EntityDataByKind = {
  input: InputRecordSchema,
  requirements: RequirementsSchema,
  assumptions: AssumptionsRecordSchema,
  brief: CreativeBriefSchema,
  script: ScriptSchema,
  character: CharacterSchema,
  location: LocationSchema,
  prop: PropSchema,
  reference: z.object({ id: z.string(), kind: z.string(), prompt: z.string(), assetId: z.string().nullable() }),
  scene: SceneRecordSchema,
  shot: ShotSchema,
  audio_segment: AudioSegmentSchema,
  voice: VoiceRecordSchema,
  observation: ObservationSchema,
  review: ReviewRecordSchema,
  timeline: ProductionTimelineSchema,
  questions: QuestionsRecordSchema,
} as const;

export const parseEntityData = (kind: EntityKind, data: unknown) => {
  const schema = EntityDataByKind[kind];
  return schema.parse(data);
};

export const isEntityKind = (value: string): value is EntityKind =>
  (ENTITY_KINDS as readonly string[]).includes(value);
