import type { StarColumns } from '../catalog/format';
import { bvToTemperature } from '../astro/color';
import { temperatureToSpectralClass, absMagToLuminosity } from '../astro/spectral';
import { generatePlanets } from './planetGen';
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
  const planets = real && real.length > 0
    ? real
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
