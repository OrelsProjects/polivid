/** Where each prototype page lives in the Studio preview. */
export const STUDIO_HREF = {
  home: "/studio",
  create: "/studio/create",
  projects: "/studio/projects",
  /** Project.dc.html: ready output (v1). */
  project: "/studio/projects/click-then-sleep",
  /** ProjectRecovery.dc.html: same editor with failure states. */
  recovery: "/studio/projects/why-sleep-matters",
  /** Batch.dc.html: article → batch. */
  batch: "/studio/projects/october-newsletter",
  sources: "/studio/sources",
  publish: "/studio/publish",
  automations: "/studio/automations",
} as const;
