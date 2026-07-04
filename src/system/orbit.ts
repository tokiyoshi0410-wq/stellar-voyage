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
