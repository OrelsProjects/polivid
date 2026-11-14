import type { CharacterLookItem, CharacterMediaItem } from "./media";

export interface CharacterSummary {
  id: string;
  name: string;
  imageKey: string | null;
  imageUrl: string | null;
  imagePrompt: string | null;
  hasImage: boolean;
  hasVoice: boolean;
  voiceSource: string | null;
  voiceDescription: string | null;
  sampleCount: number;
  description: string | null;
  personality: string | null;
  speakingStyle: string | null;
  /** The owner confirmed the person shown is them, or agreed to be shown. */
  consented: boolean;
  media: CharacterMediaItem[];
  looks: CharacterLookItem[];
  createdAt: string;
  updatedAt: string;
}
