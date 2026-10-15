import type { DevelopOutput, StructureOutput } from "../schema";
import { addDependency, putEntity, updateProduction } from "../store";

export const persistDevelop = async (productionId: string, develop: DevelopOutput) => {
  await putEntity(productionId, "requirements", "requirements", develop.requirements, "planner");
  await putEntity(productionId, "assumptions", "assumptions", develop.assumptions, "planner");
  await putEntity(productionId, "questions", "questions", develop.questions, "planner");
  await putEntity(productionId, "brief", "brief", develop.brief, "planner");
  await putEntity(productionId, "script", "script", develop.script, "planner");
  await updateProduction(productionId, { title: develop.script.title });
};

export const persistStructure = async (productionId: string, structure: StructureOutput) => {
  for (const character of structure.characters) {
    const version = await putEntity(productionId, "character", character.id, character, "planner");
    await addDependency(productionId, { kind: "entity_version", id: version.id }, { kind: "character", id: character.id });
  }
  for (const location of structure.locations) {
    await putEntity(productionId, "location", location.id, location, "planner");
  }
  for (const prop of structure.props) {
    await putEntity(productionId, "prop", prop.id, prop, "planner");
  }
  for (const scene of structure.scenes) {
    await putEntity(productionId, "scene", scene.id, scene, "planner");
  }
  for (const shot of structure.shots) {
    const version = await putEntity(productionId, "shot", shot.id, shot, "planner");
    for (const characterId of shot.characterIds) {
      await addDependency(productionId, { kind: "character", id: characterId }, { kind: "entity_version", id: version.id });
    }
    if (shot.dependsOn) {
      await addDependency(productionId, { kind: "shot", id: shot.dependsOn }, { kind: "shot", id: shot.id });
    }
  }
  for (const segment of structure.audioSegments) {
    const version = await putEntity(productionId, "audio_segment", segment.id, segment, "planner");
    for (const shotId of segment.shotIds) {
      await addDependency(productionId, { kind: "shot", id: shotId }, { kind: "entity_version", id: version.id });
    }
  }
  for (const voice of structure.voices) {
    await putEntity(productionId, "voice", voice.id, voice, "planner");
  }
};
