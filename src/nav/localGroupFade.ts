const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

// 近傍星野 → 天の川銀河（1つ）へのフェード。天の川はここで入り、以降ズームアウトしても
// 見え続ける（カメラが遠ざかるので自然に小さくなる）。
export const LOCALGROUP_FADE_START_AU = 3e9;
export const LOCALGROUP_FADE_END_AU = 1e10;

export function localGroupFade(viewDistanceAu: number): number {
  return smoothstep(clamp(
    (viewDistanceAu - LOCALGROUP_FADE_START_AU) / (LOCALGROUP_FADE_END_AU - LOCALGROUP_FADE_START_AU),
    0, 1,
  ));
}

// 天の川の外側に広がる宇宙の大規模構造（銀河団 → 超銀河団）のフェードイン。
// 天の川が確立した後に周囲の銀河たちが現れる。
export const COSMIC_WEB_FADE_START_AU = 1.2e10;
export const COSMIC_WEB_FADE_END_AU = 8e10;

export function cosmicWebFade(viewDistanceAu: number): number {
  return smoothstep(clamp(
    (viewDistanceAu - COSMIC_WEB_FADE_START_AU) / (COSMIC_WEB_FADE_END_AU - COSMIC_WEB_FADE_START_AU),
    0, 1,
  ));
}

// 大規模構造を包む「観測可能な宇宙の地平線」(CMB 球殻)のフェードイン。ズームアウトの終着点。
export const UNIVERSE_FADE_START_AU = 8e11;
export const UNIVERSE_FADE_END_AU = 3e12;

export function universeFade(viewDistanceAu: number): number {
  return smoothstep(clamp(
    (viewDistanceAu - UNIVERSE_FADE_START_AU) / (UNIVERSE_FADE_END_AU - UNIVERSE_FADE_START_AU),
    0, 1,
  ));
}
