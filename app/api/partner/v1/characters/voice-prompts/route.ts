import { voicePrompts } from "@/lib/partners/characters";
import { partnerRoute } from "@/lib/partners/http";

/** The lines to read aloud, in order, for a character with the person's own voice. */
export const GET = partnerRoute(async () => ({ prompts: voicePrompts() }));
