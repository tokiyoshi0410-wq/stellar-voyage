import { describe, it, expect } from 'vitest';
import { orbitPosition, planetPhase, orbitalAngularSpeed, animatedPhase } from '../../src/system/orbit';

describe('orbitPosition', () => {
  it('places at radius a in the xz plane', () => {
    const [x, y, z] = orbitPosition(3, 0);
    expect(x).toBeCloseTo(3, 6); expect(y).toBe(0); expect(z).toBeCloseTo(0, 6);
    const p = orbitPosition(2, Math.PI / 2);
    expect(p[0]).toBeCloseTo(0, 6); expect(p[2]).toBeCloseTo(2, 6);
  });
  it('distance from origin equals a', () => {
    const [x, y, z] = orbitPosition(4.2, 1.1);
    expect(Math.hypot(x, y, z)).toBeCloseTo(4.2, 6);
  });
});

describe('planetPhase', () => {
  it('is deterministic and in [0, 2π)', () => {
    const a = planetPhase(10, 2); const b = planetPhase(10, 2);
    expect(a).toBe(b); expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(Math.PI * 2);
  });
  it('varies by planet index', () => {
    expect(planetPhase(10, 0)).not.toBe(planetPhase(10, 1));
  });
});

describe('orbitalAngularSpeed', () => {
  it('is faster for inner orbits (monotonic decreasing in a)', () => {
    expect(orbitalAngularSpeed(0.39)).toBeGreaterThan(orbitalAngularSpeed(1));
    expect(orbitalAngularSpeed(1)).toBeGreaterThan(orbitalAngularSpeed(30));
  });
  it('clamps extremely small a to a finite max (both hit the same cap)', () => {
    expect(orbitalAngularSpeed(1e-4)).toBe(orbitalAngularSpeed(1e-6));
  });
});

describe('animatedPhase', () => {
  it('equals planetPhase at t=0', () => {
    expect(animatedPhase(0, 2, 1, 0)).toBe(planetPhase(0, 2));
  });
  it('advances by omega*t', () => {
    expect(animatedPhase(0, 2, 1, 3)).toBeCloseTo(planetPhase(0, 2) + orbitalAngularSpeed(1) * 3, 9);
  });
});
