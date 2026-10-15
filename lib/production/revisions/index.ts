export interface DependencyEdge {
  fromId: string;
  fromKind: string;
  toId: string;
  toKind: string;
}

export interface InvalidationResult {
  staleIds: string[];
  regenerationKeys: string[];
}

const walk = (startIds: string[], edges: DependencyEdge[]) => {
  const downstream = new Set<string>();
  const queue = [...startIds];
  while (queue.length) {
    const id = queue.shift()!;
    for (const edge of edges) {
      if (edge.fromId !== id) continue;
      if (downstream.has(edge.toId)) continue;
      downstream.add(edge.toId);
      queue.push(edge.toId);
    }
  }
  return [...downstream];
};

export const invalidate = (changedIds: string[], edges: DependencyEdge[]): InvalidationResult => {
  const staleIds = walk(changedIds, edges);
  const regenerationKeys = staleIds.filter((id) => id.includes(":"));
  return { staleIds, regenerationKeys };
};

export const estimateInvalidation = (keys: string[], perShotUsd: number) => {
  const shots = keys.filter((key) => key.includes("shot") || key.includes("review_shot")).length;
  const audio = keys.filter((key) => /music|ambience|sfx|speech/.test(key)).length;
  return Math.round((shots * perShotUsd + audio * 0.05) * 100) / 100;
};
