export function mergeWhisperPage<T extends { id: number }>(current: T[], incoming: T[]): T[] {
  const incomingById = new Map(incoming.map((item) => [item.id, item]));
  const merged = current.map((item) => incomingById.get(item.id) || item);
  const currentIds = new Set(current.map((item) => item.id));
  for (const item of incoming) {
    if (!currentIds.has(item.id)) merged.push(item);
  }
  return merged;
}

export function hasMoreWhispers(loadedCount: number, serverTotal: number): boolean {
  return loadedCount < serverTotal;
}
