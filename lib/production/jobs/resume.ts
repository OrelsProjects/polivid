export type ResumeTarget = "jobs" | "structure" | "develop";

export const resumeTarget = (args: { failedJobCount: number; hasDevelop: boolean }): ResumeTarget => {
  if (args.failedJobCount > 0) return "jobs";
  if (args.hasDevelop) return "structure";
  return "develop";
};
