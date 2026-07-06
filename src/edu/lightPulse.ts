import { formatLightTime } from './scaleInfo';

// 1 AU を光が進む時間（分・scaleInfo と同値）
const LIGHT_MIN_PER_AU = 8.317;
// 波紋が realtime 1秒で現在ビューの何割広がるか（見た目テンポ・実機調整）
const PULSE_SPEED_FRACTION = 0.35;

// 波紋の成長速度(AU/秒)。どのスケールでも画面上一定テンポに見えるよう現在の視距離に比例させる。
export function pulseGrowthAuPerSec(viewDistanceAu: number): number {
  return PULSE_SPEED_FRACTION * viewDistanceAu;
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
