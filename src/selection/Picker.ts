import type { StarColumns } from '../catalog/format';

export function pickStar(
  cameraPos: [number, number, number],
  rayDir: [number, number, number],
  columns: StarColumns,
  maxAngleRad: number,
): number | null {
  const [cx, cy, cz] = cameraPos;
  const rlen = Math.hypot(rayDir[0], rayDir[1], rayDir[2]) || 1;
  const rx = rayDir[0] / rlen, ry = rayDir[1] / rlen, rz = rayDir[2] / rlen;
  const cosMax = Math.cos(maxAngleRad);
  let bestDot = cosMax;
  let best: number | null = null;
  for (let i = 0; i < columns.count; i++) {
    const dx = columns.x[i]! - cx, dy = columns.y[i]! - cy, dz = columns.z[i]! - cz;
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) continue;
    const dot = (dx * rx + dy * ry + dz * rz) / len;
    if (dot >= bestDot) { bestDot = dot; best = i; }
  }
  return best;
}
