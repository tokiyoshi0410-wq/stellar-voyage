import type { StellarSystem } from './types';
import { orbitPosition, animatedPhase } from './orbit';

export function pickPlanet(
  cameraPos: [number, number, number],
  rayDir: [number, number, number],
  system: StellarSystem,
  maxAngleRad: number,
  t = 0,
): number | null {
  const rlen = Math.hypot(rayDir[0], rayDir[1], rayDir[2]) || 1;
  const rx = rayDir[0] / rlen, ry = rayDir[1] / rlen, rz = rayDir[2] / rlen;
  let bestDot = Math.cos(maxAngleRad);
  let best: number | null = null;
  system.planets.forEach((p, i) => {
    const [px, py, pz] = orbitPosition(p.semiMajorAxisAu, animatedPhase(system.starIndex, i, p.semiMajorAxisAu, t));
    const dx = px - cameraPos[0], dy = py - cameraPos[1], dz = pz - cameraPos[2];
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return;
    const dot = (dx * rx + dy * ry + dz * rz) / len;
    if (dot >= bestDot) { bestDot = dot; best = i; }
  });
  return best;
}
