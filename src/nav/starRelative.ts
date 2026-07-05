export function starRelativeAu(
  posPc: [number, number, number],
  focusPc: [number, number, number],
  scaleAuPerPc: number,
  cameraAu: [number, number, number],
): [number, number, number] {
  return [
    (posPc[0] - focusPc[0]) * scaleAuPerPc - cameraAu[0],
    (posPc[1] - focusPc[1]) * scaleAuPerPc - cameraAu[1],
    (posPc[2] - focusPc[2]) * scaleAuPerPc - cameraAu[2],
  ];
}
