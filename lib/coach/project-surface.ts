/** Which project the coach should show, if any. A newer job covers the open project while it films. Cancel uncovers it. */
export const visibleCoachProject = <T extends { sourceVideoId: string | null }>(input: {
  project: T | null;
  heldProject: T | null;
  activeJobId: string | null;
  jobStatus: string | null;
}): T | null => {
  const displaced = Boolean(input.project && input.activeJobId && input.project.sourceVideoId !== input.activeJobId);
  if (input.jobStatus === "canceled") {
    if (displaced) return input.project;
    return input.project ?? input.heldProject;
  }
  if (displaced) return null;
  return input.project;
};

/** The filming stage and the editor replace the chat. A canceled video does not. */
export const isCoachProjectMode = (input: {
  visibleProject: boolean;
  activeJobId: string | null;
  jobStatus: string | null;
}) => input.visibleProject || (Boolean(input.activeJobId) && input.jobStatus !== "canceled");
