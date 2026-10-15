import "server-only";
import { generateText } from "ai";
import { openrouter } from "./openrouter";

const TRANSCRIBE_MODEL = "anthropic/claude-sonnet-5.5";

/** Transcribes speech from an uploaded audio or video file. */
export const transcribeMedia = async (dataUrl: string, mediaType: string) => {
  const result = await generateText({
    model: openrouter().chat(TRANSCRIBE_MODEL),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcribe the spoken words in this file. Return plain text only, no timestamps or labels.",
          },
          { type: "file", data: dataUrl, mediaType },
        ],
      },
    ],
  });
  const text = result.text.trim();
  if (!text) throw new Error("Couldn't transcribe that file.");
  return text;
};
