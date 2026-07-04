import type { Planet, PlanetType } from './types';
import { inHabitableZone } from './habitableZone';

interface SolarDef { name: string; type: PlanetType; a: number; r: number; hasRing?: boolean }

const SOLAR: SolarDef[] = [
  { name: '水星', type: 'rock',  a: 0.39, r: 0.38 },
  { name: '金星', type: 'rock',  a: 0.72, r: 0.95 },
  { name: '地球', type: 'ocean', a: 1.00, r: 1.00 },
  { name: '火星', type: 'rock',  a: 1.52, r: 0.53 },
  { name: '木星', type: 'gas',   a: 5.20, r: 11.2 },
  { name: '土星', type: 'gas',   a: 9.58, r: 9.45, hasRing: true },
  { name: '天王星', type: 'ice', a: 19.2, r: 4.01 },
  { name: '海王星', type: 'ice', a: 30.1, r: 3.88 },
];

const DENSITY: Record<PlanetType, number> = { rock: 1.0, ocean: 0.7, ice: 0.4, gas: 0.2 };

// 太陽系（太陽光度 = 1 でハビタブルゾーン判定）
export function getSolarSystem(): Planet[] {
  return SOLAR.map((d) => ({
    name: d.name,
    type: d.type,
    semiMajorAxisAu: d.a,
    radiusEarth: d.r,
    massEarth: DENSITY[d.type] * Math.pow(d.r, 3),
    eqTempK: null,
    inHabitableZone: inHabitableZone(d.a, 1),
    isReal: true,
    estimated: false,
    hasRing: d.hasRing ?? false,
  }));
}
