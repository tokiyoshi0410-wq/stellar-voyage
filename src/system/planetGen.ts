import { mulberry32 } from './rng';
import { inHabitableZone } from './habitableZone';
import type { Planet, PlanetType } from './types';

// 雪線（凍結線）: おおよそ 2.7 * sqrt(L) AU
export function snowLineAu(luminositySun: number): number {
  return 2.7 * Math.sqrt(luminositySun);
}

export function classifyPlanetType(
  semiMajorAxisAu: number, luminositySun: number, rand: number,
): PlanetType {
  if (semiMajorAxisAu >= snowLineAu(luminositySun)) {
    return rand < 0.5 ? 'gas' : 'ice';
  }
  return inHabitableZone(semiMajorAxisAu, luminositySun) && rand < 0.6 ? 'ocean' : 'rock';
}

const RADIUS_RANGE: Record<PlanetType, [number, number]> = {
  rock: [0.4, 1.6], ocean: [0.8, 2.5], ice: [1.0, 4.0], gas: [4.0, 12.0],
};
const DENSITY: Record<PlanetType, number> = { rock: 1.0, ocean: 0.7, ice: 0.4, gas: 0.2 };

function planetCount(spectralClass: string, rand: () => number): number {
  const base = 'OB'.includes(spectralClass) ? 3 : 'AF'.includes(spectralClass) ? 5 : 7;
  return Math.floor(rand() * base); // 0..base-1
}

export function generatePlanets(
  starIndex: number, spectralClass: string, luminositySun: number,
): Planet[] {
  const rand = mulberry32((starIndex * 2654435761) >>> 0);
  const n = planetCount(spectralClass, rand);
  const planets: Planet[] = [];
  let a = 0.2 + rand() * 0.3;
  for (let i = 0; i < n; i++) {
    a *= 1.4 + rand() * 1.2;
    const type = classifyPlanetType(a, luminositySun, rand());
    const [rmin, rmax] = RADIUS_RANGE[type];
    const radiusEarth = rmin + rand() * (rmax - rmin);
    const massEarth = DENSITY[type] * Math.pow(radiusEarth, 3);
    planets.push({
      name: `${i + 1}番惑星`,
      type,
      semiMajorAxisAu: a,
      radiusEarth,
      massEarth,
      eqTempK: null,
      inHabitableZone: inHabitableZone(a, luminositySun),
      isReal: false,
      estimated: false,
    });
  }
  return planets;
}
