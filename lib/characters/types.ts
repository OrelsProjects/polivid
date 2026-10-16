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
  createdAt: string;
  updatedAt: string;
}
