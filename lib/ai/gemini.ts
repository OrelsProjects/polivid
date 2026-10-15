/** Gemini API key from Google AI Studio. Only Gemini Omni video uses it. */
export const hasGeminiKey = () => Boolean(process.env.GEMINI_API_KEY);

export const geminiApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
};
