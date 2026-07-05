import type { StarColumns } from '../catalog/format';

export function nearestStarPc(
  focusPc: [number, number, number],
  columns: StarColumns,
): { index: number; distPc: number } {
  let best = 0, bestD2 = Infinity;
  for (let i = 0; i < columns.count; i++) {
    const dx = columns.x[i]! - focusPc[0], dy = columns.y[i]! - focusPc[1], dz = columns.z[i]! - focusPc[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  return { index: best, distPc: Math.sqrt(bestD2) };
}
