import type { UIMessage } from "ai";

/** Append a new chat message, or replace one the client updated (tool approval or tool output). */
export const mergeCoachTurn = (previous: readonly UIMessage[], incoming: UIMessage): UIMessage[] => {
  const index = previous.findIndex((message) => message.id === incoming.id);
  if (index === -1) return [...previous, incoming];
  return previous.map((message, messageIndex) => (messageIndex === index ? incoming : message));
};
