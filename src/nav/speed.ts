export const MIN_SPEED_AU_S = 0.5;
export const MAX_SPEED_AU_S = 2e6; // ≈ 9.7 pc/s ≈ 31 光年/秒
const AU_PER_LY = 63241.077;

export function speedFromSlider(v: number): number {
  const t = Math.max(0, Math.min(1, v));
  return MIN_SPEED_AU_S * Math.pow(MAX_SPEED_AU_S / MIN_SPEED_AU_S, t);
}

export function formatSpeed(auPerSec: number): string {
  if (auPerSec < 1000) return `${auPerSec.toFixed(auPerSec < 10 ? 1 : 0)} AU/秒`;
  const lyPerSec = auPerSec / AU_PER_LY;
  return `${lyPerSec.toPrecision(2)} 光年/秒`;
}
