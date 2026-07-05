import { mulberry32 } from './rng';

export function orbitPosition(semiMajorAxisAu: number, phaseRad: number): [number, number, number] {
  return [
    semiMajorAxisAu * Math.cos(phaseRad),
    0,
    semiMajorAxisAu * Math.sin(phaseRad),
  ];
}

export function planetPhase(starIndex: number, planetIndex: number): number {
  const rand = mulberry32(((starIndex * 73856093) ^ (planetIndex * 19349663)) >>> 0);
  return rand() * Math.PI * 2;
}

const ANIM_EARTH_PERIOD_SEC = 12;                    // 地球(a=1)の周回秒数（実機調整）
const ANIM_K = (2 * Math.PI) / ANIM_EARTH_PERIOD_SEC;
const ANIM_MAX_OMEGA = Math.PI;                      // 角速度上限(≈2秒/周)。極端に内側の高速スピン防止

/** ケプラー第三法則: 角速度 ∝ a^-1.5（内側ほど速い）。上限クランプ。rad/秒。 */
export function orbitalAngularSpeed(semiMajorAxisAu: number): number {
  return Math.min(ANIM_K * Math.pow(semiMajorAxisAu, -1.5), ANIM_MAX_OMEGA);
}

/** 時刻 t 秒での軌道位相 = planetPhase + ω(a)·t */
export function animatedPhase(
  starIndex: number, planetIndex: number, semiMajorAxisAu: number, t: number,
): number {
  return planetPhase(starIndex, planetIndex) + orbitalAngularSpeed(semiMajorAxisAu) * t;
}
