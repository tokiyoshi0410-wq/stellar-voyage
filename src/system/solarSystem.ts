import type { Planet, PlanetType } from './types';
import { inHabitableZone } from './habitableZone';

interface SolarDef { name: string; type: PlanetType; a: number; r: number; m: number; hasRing?: boolean }

const SOLAR: SolarDef[] = [
  { name: '水星', type: 'rock',  a: 0.39, r: 0.38, m: 0.0553 },
  { name: '金星', type: 'rock',  a: 0.72, r: 0.95, m: 0.815 },
  { name: '地球', type: 'ocean', a: 1.00, r: 1.00, m: 1.0 },
  { name: '火星', type: 'rock',  a: 1.52, r: 0.53, m: 0.107 },
  { name: '木星', type: 'gas',   a: 5.20, r: 11.2, m: 317.8 },
  { name: '土星', type: 'gas',   a: 9.58, r: 9.45, m: 95.2, hasRing: true },
  { name: '天王星', type: 'ice', a: 19.2, r: 4.01, m: 14.5 },
  { name: '海王星', type: 'ice', a: 30.1, r: 3.88, m: 17.1 },
];

// 太陽系（太陽光度 = 1 でハビタブルゾーン判定）
export function getSolarSystem(): Planet[] {
  return SOLAR.map((d) => ({
    name: d.name,
    type: d.type,
    semiMajorAxisAu: d.a,
    radiusEarth: d.r,
    massEarth: d.m,
    eqTempK: null,
    inHabitableZone: inHabitableZone(d.a, 1),
    isReal: true,
    estimated: false,
    hasRing: d.hasRing ?? false,
  }));
}
