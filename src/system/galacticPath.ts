export const GAL_PATH_R = 40;                    // 弧半径（AU, 見栄え）
export const GAL_ARC_SPAN = (2 * Math.PI) / 3;   // 弧の全角 120°（a∈[-π/3, π/3]）
export const GAL_MARKER_COUNT = 6;               // 道標の数（実機調整）
export const GAL_FLOW_SPEED = 0.15;              // rad/秒（実機調整）

/** 弧パラメータ a での道すじ座標（0.35 の傾き適用前。太陽=a=0=原点）。 */
export function galacticPathPoint(a: number, R = GAL_PATH_R): [number, number, number] {
  return [R * Math.sin(a), 0, -R + R * Math.cos(a)];
}

/**
 * 道標マーカー k（全 count 個, 等間隔）の時刻 t での弧パラメータ。
 * 前方(+π/3)→太陽(0)→後方(-π/3) へ流れてループ（車と道路）。flowSpeed rad/秒。
 * 返り値は (-π/3, π/3] にラップ。
 */
export function galacticMarkerParam(k: number, count: number, t: number, flowSpeed: number): number {
  const raw = (k / count) * GAL_ARC_SPAN + t * flowSpeed;
  const wrapped = ((raw % GAL_ARC_SPAN) + GAL_ARC_SPAN) % GAL_ARC_SPAN; // [0, SPAN)
  return Math.PI / 3 - wrapped;                                          // [+π/3 .. -π/3)（減少）
}

export const SYSTEM_TRAVEL_SPEED = 0.12; // 往復の角速度係数 rad/秒（実機調整）
export const SYSTEM_TRAVEL_AMP = 0.28;   // 振幅 rad（弧の中央付近 ±約11AU・画面内に収める, 実機調整）

/**
 * 太陽系が金の道を進む弧パラメータ。中央(0)を基準に振幅 SYSTEM_TRAVEL_AMP で
 * 滑らかに往復（sine）してループ。t=0 で 0（中心）。範囲は [-SYSTEM_TRAVEL_AMP, SYSTEM_TRAVEL_AMP]
 * ⊂ [-π/3, π/3] に収まり、画面外ワープのカクつきが無い。speed は往復の角速度。
 */
export function systemTravelParam(t: number, speed: number): number {
  return SYSTEM_TRAVEL_AMP * Math.sin(t * speed);
}
