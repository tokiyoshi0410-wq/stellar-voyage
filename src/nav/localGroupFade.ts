const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const LOCALGROUP_FADE_START_AU = 3e9;
export const LOCALGROUP_FADE_END_AU = 1e10;

export function localGroupFade(viewDistanceAu: number): number {
  const t = clamp(
    (viewDistanceAu - LOCALGROUP_FADE_START_AU) / (LOCALGROUP_FADE_END_AU - LOCALGROUP_FADE_START_AU),
    0, 1,
  );
  return t * t * (3 - 2 * t);
}
