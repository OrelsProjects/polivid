import "server-only";
import { generateImage } from "@/lib/images/generate";

const portraitPrompt = (description: string) =>
  `Portrait of one person. ${description.trim()} Head and shoulders, facing the camera, even lighting, photorealistic, no text, no watermark, no logo.`;

export const generateCharacterImage = async (userId: string, description: string) => {
  const prompt = portraitPrompt(description);
  return generateImage(userId, { prompt, format: "1:1" });
};
