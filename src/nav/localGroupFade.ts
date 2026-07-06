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

export const ANDROMEDA_FADE_START_AU = 2e10;
export const ANDROMEDA_FADE_END_AU = 3.5e10;

// ズームアウトで天の川→アンドロメダへ切り替える度合い（0=天の川, 1=アンドロメダ）。
export function andromedaFade(viewDistanceAu: number): number {
  const t = clamp(
    (viewDistanceAu - ANDROMEDA_FADE_START_AU) / (ANDROMEDA_FADE_END_AU - ANDROMEDA_FADE_START_AU),
    0, 1,
  );
  return t * t * (3 - 2 * t);
}

// 局部銀河群段での2銀河の不透明度。天の川群は localGroupFade で入り andromedaFade で抜ける、
// アンドロメダは andromedaFade で入る。どちらも localGroupFade=0 の段以前は 0。
export function localGroupOpacities(viewDistanceAu: number): { milkyWay: number; andromeda: number } {
  const lg = localGroupFade(viewDistanceAu);
  const a = andromedaFade(viewDistanceAu);
  return { milkyWay: lg * (1 - a), andromeda: lg * a };
}
