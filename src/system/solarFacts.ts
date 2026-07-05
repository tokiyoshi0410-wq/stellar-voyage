import { formatLightTime } from '../edu/scaleInfo';

export interface PlanetFacts {
  orbitalSpeedKmS: number;
  orbitalPeriodYr: number;
  rotationSpeedKmH: number; // 赤道
  retrograde: boolean;
}

// getSolarSystem() と index 整合（0=水星 … 7=海王星）
export const PLANET_FACTS: PlanetFacts[] = [
  { orbitalSpeedKmS: 47.4, orbitalPeriodYr: 0.24, rotationSpeedKmH: 11,    retrograde: false }, // 水星
  { orbitalSpeedKmS: 35.0, orbitalPeriodYr: 0.62, rotationSpeedKmH: 6.5,   retrograde: true  }, // 金星
  { orbitalSpeedKmS: 29.8, orbitalPeriodYr: 1.00, rotationSpeedKmH: 1674,  retrograde: false }, // 地球
  { orbitalSpeedKmS: 24.1, orbitalPeriodYr: 1.88, rotationSpeedKmH: 866,   retrograde: false }, // 火星
  { orbitalSpeedKmS: 13.1, orbitalPeriodYr: 11.9, rotationSpeedKmH: 45000, retrograde: false }, // 木星
  { orbitalSpeedKmS: 9.7,  orbitalPeriodYr: 29.5, rotationSpeedKmH: 35500, retrograde: false }, // 土星
  { orbitalSpeedKmS: 6.8,  orbitalPeriodYr: 84,   rotationSpeedKmH: 9320,  retrograde: true  }, // 天王星
  { orbitalSpeedKmS: 5.4,  orbitalPeriodYr: 165,  rotationSpeedKmH: 9660,  retrograde: false }, // 海王星
];

export interface SunFacts {
  galacticSpeedKmS: number;
  galacticPeriodYr: number;
  galacticCenterLy: number;
  rotationSpeedKmH: number;
}
export const SUN_FACTS: SunFacts = {
  galacticSpeedKmS: 220,
  galacticPeriodYr: 2.3e8,
  galacticCenterLy: 26000,
  rotationSpeedKmH: 7200,
};

const AU_KM = 1.496e8;
const LIGHT_KM_S = 299792.458;
const SHINKANSEN_KMH = 300;

/** 地球からの最接近距離（円軌道近似, AU） */
export function earthClosestApproachAu(semiMajorAxisAu: number): number {
  return Math.abs(semiMajorAxisAu - 1);
}

/** AU を「約N万km」/「約N億km」(>=1億km) で。万km は 100万km 単位に丸め。 */
export function formatManKm(au: number): string {
  const km = au * AU_KM;
  const oku = km / 1e8;
  if (oku >= 1) return `約${Number(oku.toPrecision(2))}億km`;
  const man = km / 1e4;
  return `約${Math.round(man / 100) * 100}万km`;
}

/** 距離(AU)を光が進む時間（既存 formatLightTime へ委譲） */
export function formatLightTravel(au: number): string {
  const lightMinutes = (au * AU_KM) / LIGHT_KM_S / 60;
  return formatLightTime(lightMinutes);
}

/** 距離(AU)を新幹線(300km/h)で進む時間（主に年、<1年は日） */
export function formatShinkansenTravel(au: number): string {
  const hours = (au * AU_KM) / SHINKANSEN_KMH;
  const years = hours / (24 * 365);
  if (years >= 1) return `約${Math.round(years)}年`;
  return `約${Math.round(hours / 24)}日`;
}
