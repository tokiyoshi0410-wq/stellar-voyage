export function pickPlanet(
  cameraPos: [number, number, number],
  rayDir: [number, number, number],
  positions: readonly [number, number, number][],
  maxAngleRad: number,
): number | null {
  const rlen = Math.hypot(rayDir[0], rayDir[1], rayDir[2]) || 1;
  const rx = rayDir[0] / rlen, ry = rayDir[1] / rlen, rz = rayDir[2] / rlen;
  let bestDot = Math.cos(maxAngleRad);
  let best: number | null = null;
  positions.forEach((pos, i) => {
    const dx = pos[0] - cameraPos[0], dy = pos[1] - cameraPos[1], dz = pos[2] - cameraPos[2];
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return;
    const dot = (dx * rx + dy * ry + dz * rz) / len;
    if (dot >= bestDot) { bestDot = dot; best = i; }
  });
  return best;
}
