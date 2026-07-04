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
