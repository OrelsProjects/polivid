import "server-only";
import { importMediaFromUrl } from "@/lib/storage/import-url";
import type { ToolHandler } from "@/lib/tools/types";
import { asRecord, text } from "./support";

export const importMediaFromUrlHandler: ToolHandler = async (input, ctx) => importMediaFromUrl(ctx.userId, text(asRecord(input).url));
