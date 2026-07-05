export function systemFade(viewDistanceAu: number): number {
  const t = Math.max(0, Math.min(1, (viewDistanceAu - 300) / (30000 - 300)));
  const s = t * t * (3 - 2 * t);
  return 1 - s;
}
