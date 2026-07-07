import type { StarColumns } from '../catalog/format';
import { bvToTemperature } from '../astro/color';
import {
  temperatureToSpectralClass, parsecsToLightYears, absMagToLuminosity,
} from '../astro/spectral';

export interface StarInfo {
  title: string;
  spectralClass: string;
  temperatureK: number;
  luminositySun: number;
  distanceLy: number;
  isReal: boolean;
}

const C_KM_S = 299792.458;

export function formatSpeed(speedC: number): string {
  if (speedC < 1) return `${Math.round(speedC * C_KM_S).toLocaleString('ja-JP')} km/s`;
  if (speedC < 1000) return `${speedC.toFixed(1)} ×c`;
  return `${speedC.toExponential(1)} ×c`;
}

export function formatDistanceLy(pc: number): string {
  const ly = parsecsToLightYears(pc);
  const shown = ly < 100 ? ly.toFixed(2) : Math.round(ly).toLocaleString('ja-JP');
  return `${shown} 光年`;
}

export function describeStar(columns: StarColumns, index: number, name: string | null): StarInfo {
  const tempK = bvToTemperature(columns.ci[index]!);
  const distPc = Math.hypot(columns.x[index]!, columns.y[index]!, columns.z[index]!);
  return {
    title: name ?? `HYG #${index}`,
    spectralClass: temperatureToSpectralClass(tempK),
    temperatureK: Math.round(tempK),
    luminositySun: absMagToLuminosity(columns.absmag[index]!),
    distanceLy: parsecsToLightYears(distPc),
    isReal: true,
  };
}

// 1 AU = 1.496×10^8 km = 1.496 億km
export const AU_IN_OKUKM = 1.496;

export function formatAuDistance(au: number): string {
  const auStr = au >= 10 ? au.toFixed(0) : au.toFixed(au < 1 ? 2 : 1);
  // toPrecision(2) は3桁以上で指数表記になる（遠方惑星 a>66AU で "2.4e+2"）。Number() で固定表記へ。
  const okm = Number((au * AU_IN_OKUKM).toPrecision(2)).toLocaleString('ja-JP', { maximumFractionDigits: 8 });
  return `${auStr} AU ≈ ${okm}億km`;
}

// 光度（太陽比）を人間可読に。明るい星でも指数表記にしない（"1.36e+5"→"136,000"）。
export function formatLuminosity(luminositySun: number): string {
  if (luminositySun >= 1000) return Math.round(luminositySun).toLocaleString('en-US');
  if (luminositySun >= 1) return String(Number(luminositySun.toPrecision(3)));
  return String(Number(luminositySun.toPrecision(2)));
}

// 距離（光年）を。近い星は小数1桁、遠い星は整数＋桁区切り。
export function formatLy(ly: number): string {
  return ly < 100 ? `${ly.toFixed(1)} 光年` : `${Math.round(ly).toLocaleString('ja-JP')} 光年`;
}

// 星の表示名: 太陽（HYG index 0）は日本語で「太陽」、固有名の無い星は「HYG #番号」。
export function starDisplayName(index: number, name: string | null): string {
  if (index === 0) return '太陽';
  return name ?? `HYG #${index}`;
}
