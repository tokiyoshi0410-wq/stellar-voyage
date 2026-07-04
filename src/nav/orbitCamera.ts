export function orbitCameraPosition(
  focus: [number, number, number],
  yaw: number,
  pitch: number,
  distance: number,
): { position: [number, number, number]; target: [number, number, number] } {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const dir: [number, number, number] = [Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp];
  return {
    position: [
      focus[0] + dir[0] * distance,
      focus[1] + dir[1] * distance,
      focus[2] + dir[2] * distance,
    ],
    target: [focus[0], focus[1], focus[2]],
  };
}
