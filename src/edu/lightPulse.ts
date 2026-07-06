import { formatLightTime } from './scaleInfo';

// 1 AU を光が進む時間（分・scaleInfo と同値）
const LIGHT_MIN_PER_AU = 8.317;
// realtime 1秒あたり何分ぶんの光が進むか（現実の光速の加速倍率・見た目チューニング）。
// 例: 6 なら「1秒で光の6分ぶん」→ 地球(1AU=8.317光分)に約1.4秒、海王星(30AU=250光分)に約42秒で届く。
const LIGHT_ACCEL_MIN_PER_SEC = 6;

// 波紋の成長速度(AU/秒)。現実の光速を LIGHT_ACCEL_MIN_PER_SEC 倍だけ加速した固定速度で、
// 視距離に依存しない。どのスケールでも同じ実速度なので太陽系では光の遅さを体感でき、
// 恒星間・銀河スケールでは光がほとんど動かず見える（＝光が実際にそれほど遅いという事実）。
export function pulseGrowthAuPerSec(): number {
  return LIGHT_ACCEL_MIN_PER_SEC / LIGHT_MIN_PER_AU;
}

// 半径(AU)を光が進むのにかかる時間(分)。
export function pulseLightTimeMin(radiusAu: number): number {
  return radiusAu * LIGHT_MIN_PER_AU;
}

// 光行時間を人間可読に。1万年以上は「約N万年」に（既存 formatLightTime の指数表記 "約1.0e+5年" を回避）。
export function formatPulseTime(lightMinutes: number): string {
  const years = lightMinutes / (60 * 24 * 365);
  if (years >= 10000) {
    const man = years / 10000;
    return `約${man >= 10 ? Math.round(man) : Number(man.toPrecision(2))}万年`;
  }
  return formatLightTime(lightMinutes);
}

// 波紋が目標距離に届いたか（境界含む）。
export function pulseReached(radiusAu: number, targetAu: number): boolean {
  return radiusAu >= targetAu;
}
