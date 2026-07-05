import type { StarColumns } from '../catalog/format';

export function nearestStarsPc(
  focusPc: [number, number, number],
  columns: StarColumns,
  count: number,
): { index: number; distPc: number }[] {
  if (count <= 0) return [];
  const best: { index: number; d2: number }[] = [];
  for (let i = 0; i < columns.count; i++) {
    const dx = columns.x[i]! - focusPc[0];
    const dy = columns.y[i]! - focusPc[1];
    const dz = columns.z[i]! - focusPc[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (best.length < count) {
      best.push({ index: i, d2 });
      best.sort((a, b) => a.d2 - b.d2);
    } else if (d2 < best[best.length - 1]!.d2) {
      best[best.length - 1] = { index: i, d2 };
      best.sort((a, b) => a.d2 - b.d2);
    }
  }
  return best.map((b) => ({ index: b.index, distPc: Math.sqrt(b.d2) }));
}
