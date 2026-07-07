import { getSolarSystem } from '../system/solarSystem';
import { earthClosestApproachAu } from '../system/solarFacts';
import { pulseLightTimeMin, formatPulseTime, pulseReached } from './lightPulse';

// 光速バー上の停止点（惑星）。左端=地球(0)からの距離で並ぶ。
export interface BarStop {
  name: string;
  earthDistAu: number;
}

// バーに並べる停止点＝地球より外側の惑星を、地球からの最接近距離（|a-1|）で。
// 惑星クリック時のパネルと同じ earthClosestApproachAu を使い、光の基準を地球に統一する。
export function barStops(): BarStop[] {
  return getSolarSystem()
    .filter((p) => p.semiMajorAxisAu > 1)
    .map((p) => ({ name: p.name, earthDistAu: earthClosestApproachAu(p.semiMajorAxisAu) }))
    .sort((a, b) => a.earthDistAu - b.earthDistAu);
}

// バー右端の距離（最遠の停止点＝海王星）。
export function barRightAu(stops: BarStop[]): number {
  return stops.length ? stops[stops.length - 1]!.earthDistAu : 1;
}

// 光が地球から進んだ距離(AU)→バー上の位置(0..1)。
export function barFraction(lightDistAu: number, rightAu: number): number {
  if (rightAu <= 0) return 0;
  return Math.max(0, Math.min(lightDistAu / rightAu, 1));
}

// 光が到達した最も遠い停止点（未到達なら null）。
export function reachedStop(lightDistAu: number, stops: BarStop[]): BarStop | null {
  let reached: BarStop | null = null;
  for (const s of stops) {
    if (pulseReached(lightDistAu, s.earthDistAu) && (reached === null || s.earthDistAu > reached.earthDistAu)) {
      reached = s;
    }
  }
  return reached;
}

// 経過光行時間＋到達通知の文言（地球基準）。
export function barReadoutText(lightDistAu: number, stops: BarStop[]): string {
  const time = formatPulseTime(pulseLightTimeMin(lightDistAu));
  const r = reachedStop(lightDistAu, stops);
  return `光の経過時間: ${time}${r ? ` ・ ${r.name}に到達` : ''}`;
}
