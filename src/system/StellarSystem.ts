import type { StarColumns } from '../catalog/format';
import { bvToTemperature } from '../astro/color';
import { temperatureToSpectralClass, absMagToLuminosity } from '../astro/spectral';
import { generatePlanets } from './planetGen';
import { inHabitableZone } from './habitableZone';
import { getSolarSystem } from './solarSystem';
import type { Planet, StellarSystem } from './types';

export function buildStellarSystem(
  columns: StarColumns,
  index: number,
  name: string | null,
  exoplanets?: Record<number, Planet[]>,
): StellarSystem {
  const temperatureK = bvToTemperature(columns.ci[index]!);
  const spectralClass = temperatureToSpectralClass(temperatureK);
  const luminositySun = absMagToLuminosity(columns.absmag[index]!);
  const real = exoplanets?.[index];
  // 実データはビルド時 inHabitableZone: false 固定で書き出されているため、
  // 恒星の光度と軌道長半径からここで実際のハビタブルゾーン判定を上書きする。
  // index 0 (太陽) は実データ・手続き生成より優先して太陽系データを使う
  // (太陽系側は L=1 で判定済みのため再計算不要)。
  const planets = index === 0
    ? getSolarSystem()
    : real && real.length > 0
      ? real.map((p) => ({ ...p, inHabitableZone: inHabitableZone(p.semiMajorAxisAu, luminositySun) }))
      : generatePlanets(index, spectralClass, luminositySun);
  return {
    starIndex: index,
    starName: name ?? `HYG #${index}`,
    spectralClass,
    temperatureK: Math.round(temperatureK),
    luminositySun,
    planets,
  };
}
