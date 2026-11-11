/**
 * History state for putting a chat id in the address bar.
 * Next.js treats `replaceState` as a navigation. A null state, on a URL it has
 * not rendered, reloads the page. Reusing the current state (and `__NA`, the
 * flag Next uses for its own history writes) changes the address only.
 */
export const coachThreadHistoryState = (current: unknown): Record<string, unknown> => {
  const base = current !== null && typeof current === "object" ? { ...(current as Record<string, unknown>) } : {};
  return { ...base, __NA: true };
};

/** Show `/coach/{id}` without loading that route over the open conversation. */
export const showCoachThreadInAddressBar = (id: string) => {
  const path = `/coach/${id}`;
  if (window.location.pathname === path) return;
  window.history.replaceState(coachThreadHistoryState(window.history.state), "", path);
};
