import "server-only";
import { db } from "@/lib/db";
import { MAX_PRESET_FRAGMENT, MAX_PRESET_NAME } from "./presets";

const poster = { from: "#d7dde6", to: "#8a93a3", accent: "#111827" };

export const toCustomTile = (row: { id: string; name: string; promptFragment: string; negativeFragment: string | null }) => ({
  id: row.id,
  name: row.name,
  tagline: row.promptFragment.slice(0, 72),
  promptFragment: row.promptFragment,
  negativeFragment: row.negativeFragment,
  poster,
});

export const listCustomPresets = async (userId: string) => {
  const rows = await db.stylePreset.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toCustomTile);
};

export const createCustomPreset = async (
  userId: string,
  input: { name: string; promptFragment: string; negativeFragment?: string },
) => {
  const name = input.name.trim().slice(0, MAX_PRESET_NAME);
  const promptFragment = input.promptFragment.trim().slice(0, MAX_PRESET_FRAGMENT);
  if (name.length < 2) throw new Error("Give the preset a name.");
  if (promptFragment.length < 8) throw new Error("Describe the look in a few words.");
  const row = await db.stylePreset.create({
    data: {
      userId,
      name,
      promptFragment,
      negativeFragment: input.negativeFragment?.trim().slice(0, MAX_PRESET_FRAGMENT) || null,
    },
  });
  return toCustomTile(row);
};

export const deleteCustomPreset = async (userId: string, id: string) => {
  const result = await db.stylePreset.deleteMany({ where: { id, userId } });
  return result.count === 1;
};
