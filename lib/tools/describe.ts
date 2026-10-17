import { AUTO_APPROVE_UNDER_CREDITS } from "@/lib/billing/auto-approve";
import { inputFields } from "./schema-fields";
import { TOOL_DEFS } from "./registry";
import { TOOL_CATEGORIES, TOOL_CATEGORY_LABELS, type ToolDefinition } from "./types";

/** Tool descriptions are sent on every turn. Keep them under this so the prompt stays usable. */
export const MAX_TOOL_DESCRIPTION_CHARS = 1_600;

const live = (definition: ToolDefinition) => (definition.status ?? "live") === "live";

export const effectNotes = (definition: ToolDefinition) => {
  const notes: string[] = [];
  if (definition.effects.readOnly) notes.push("Read only");
  if (definition.effects.spendsCredits) notes.push("Spends credits");
  if (definition.effects.destructive) notes.push("Destructive");
  if (definition.effects.longRunning) notes.push("Long-running");
  if (definition.approval === "user" && definition.effects.spendsCredits) {
    notes.push(`Needs approval at ${AUTO_APPROVE_UNDER_CREDITS} credits or more`);
  } else if (definition.approval === "user") {
    notes.push("Needs approval");
  }
  if (definition.runsOn === "client") {
    notes.push(definition.awaitsPerson ? "Waits for the person" : "Runs in the app");
  }
  if (notes.length === 0) notes.push("No side effects");
  return `${notes.join(". ")}.`;
};

/** What the model sees as the tool description. */
export const renderDescription = (definition: ToolDefinition) => {
  const lines = [definition.summary, "", "Use when:"];
  for (const item of definition.whenToUse) lines.push(`- ${item}`);
  if (definition.avoidWhen && definition.avoidWhen.length > 0) {
    lines.push("", "Don't use when:");
    for (const item of definition.avoidWhen) lines.push(`- ${item}`);
  }
  lines.push("", effectNotes(definition));
  return lines.join("\n");
};

/** A short menu for the system prompt. The full rules live on each tool. */
export const renderToolIndex = () => {
  const lines = ["Tools", "Pick the tool whose description matches the request. Read that description before you call it."];
  for (const category of TOOL_CATEGORIES) {
    const tools = TOOL_DEFS.filter((definition) => live(definition) && definition.category === category);
    if (tools.length === 0) continue;
    lines.push("", TOOL_CATEGORY_LABELS[category]);
    for (const definition of tools) {
      lines.push(`- ${definition.name}: ${definition.summary} ${effectNotes(definition)}`);
    }
  }
  return lines.join("\n");
};

const cell = (value: string) => value.replaceAll("|", "/").replaceAll("\n", " ");

const toolSection = (definition: ToolDefinition) => {
  const lines = [
    `### ${definition.name}`,
    "",
    `**${definition.title}.** ${definition.summary}`,
    "",
    effectNotes(definition),
    "",
    "Use when:",
    ...definition.whenToUse.map((item) => `- ${item}`),
  ];
  if (definition.avoidWhen && definition.avoidWhen.length > 0) {
    lines.push("", "Don't use when:", ...definition.avoidWhen.map((item) => `- ${item}`));
  }
  const fields = inputFields(definition.inputSchema);
  lines.push("", "Inputs:");
  if (fields.length === 0) {
    lines.push("- None.");
  } else {
    lines.push("", "| Field | Required | Description |", "| --- | --- | --- |");
    for (const field of fields) {
      lines.push(`| ${cell(field.name)} | ${field.required ? "yes" : "no"} | ${cell(field.description)} |`);
    }
  }
  if (definition.examples && definition.examples.length > 0) {
    lines.push("", "Examples:");
    for (const example of definition.examples) {
      lines.push("", `> ${example.request}`, "", "```json", JSON.stringify(example.input), "```");
    }
  }
  return lines.join("\n");
};

/** The catalog page. Stable text, so a freshness test can compare it to the file on disk. */
export const renderCatalogMarkdown = () => {
  const lines = [
    "# Tool catalog",
    "",
    "Generated from `lib/tools`. Do not edit by hand. Run `npm run tools:docs` after changing a tool.",
    "",
    "Each entry is what the Coach is told, plus the inputs and an example. Legacy tools are omitted.",
    "",
  ];
  for (const category of TOOL_CATEGORIES) {
    const tools = TOOL_DEFS.filter((definition) => live(definition) && definition.category === category);
    if (tools.length === 0) continue;
    lines.push(`## ${TOOL_CATEGORY_LABELS[category]}`, "");
    for (const definition of tools) {
      lines.push(toolSection(definition), "");
    }
  }
  return `${lines.join("\n").trim()}\n`;
};
