/**
 * In-memory fixed-window limiter. Per process only, which is enough to stop a runaway client
 * on one instance; it is not a security boundary.
 */
const windows = new Map<string, { start: number; count: number }>();

export const rateLimited = (key: string, limit: number, windowMs: number, now = Date.now()) => {
  const current = windows.get(key);
  if (!current || now - current.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) {
      for (const [entry, value] of windows) if (now - value.start >= windowMs) windows.delete(entry);
    }
    return false;
  }
  current.count += 1;
  return current.count > limit;
};
