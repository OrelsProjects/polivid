/**
 * Renders run one at a time in this process. Each one drives a headless browser and an
 * encoder, and two at once starve each other.
 */
let tail: Promise<unknown> = Promise.resolve();

export const withRenderSlot = <T>(work: () => Promise<T>): Promise<T> => {
  const run = tail.then(work, work);
  tail = run.catch(() => undefined);
  return run;
};
