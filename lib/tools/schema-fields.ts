import { z } from "zod";

const unwrap = (schema: z.ZodType): z.ZodType => {
  const next = schema as z.ZodType & { unwrap?: () => z.ZodType };
  if (typeof next.unwrap !== "function") return schema;
  return unwrap(next.unwrap());
};

/** The description on this field or on a wrapper around it. */
export const fieldDescription = (schema: z.ZodType) => {
  let current: z.ZodType | undefined = schema;
  const seen = new Set<z.ZodType>();
  while (current && !seen.has(current)) {
    seen.add(current);
    if (typeof current.description === "string" && current.description.trim()) return current.description.trim();
    const next = current as z.ZodType & { unwrap?: () => z.ZodType };
    if (typeof next.unwrap !== "function") break;
    current = next.unwrap();
  }
  return "";
};

export interface SchemaField {
  name: string;
  description: string;
  required: boolean;
}

/** Top-level inputs. Wrappers such as optional and default are unwrapped before the object is read. */
export const inputFields = (schema: z.ZodType): SchemaField[] => {
  const bare = unwrap(schema);
  if (!(bare instanceof z.ZodObject)) return [];
  return Object.entries(bare.shape).map(([name, field]) => {
    const typed = field as z.ZodType;
    return {
      name,
      description: fieldDescription(typed),
      required: !typed.safeParse(undefined).success,
    };
  });
};
