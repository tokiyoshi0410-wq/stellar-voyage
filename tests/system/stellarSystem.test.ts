import { describe, it, expect } from 'vitest';
import { buildStellarSystem } from '../../src/system/StellarSystem';
import { getSolarSystem } from '../../src/system/solarSystem';
import type { Planet } from '../../src/system/types';

const columns = {
  count: 2,
  x: new Float32Array([2, 3]), y: new Float32Array([0, 0]), z: new Float32Array([0, 0]),
  mag: new Float32Array([1, 1]), absmag: new Float32Array([4.83, 4.83]), ci: new Float32Array([0.63, 0.63]),
};

describe('buildStellarSystem', () => {
  it('computes star fields and a procedural system when no real data', () => {
    const sys = buildStellarSystem(columns, 0, 'Sol');
    expect(sys.starName).toBe('Sol');
    expect(sys.luminositySun).toBeCloseTo(1, 2);
    expect(['O','B','A','F','G','K','M']).toContain(sys.spectralClass);
    expect(Array.isArray(sys.planets)).toBe(true);
  });
  it('falls back to HYG index when unnamed', () => {
    expect(buildStellarSystem(columns, 0, null).starName).toBe('HYG #0');
  });
  it('prefers real exoplanet data when present (non-Sun index)', () => {
    // index 0 は太陽系データが優先されるため (Task 2)、real データ優先ロジックは
    // 太陽以外の恒星インデックスで検証する。
    const real: Planet[] = [{
      name: 'Sol b', type: 'gas', semiMajorAxisAu: 5, radiusEarth: 11, massEarth: 300,
      eqTempK: 120, inHabitableZone: false, isReal: true, estimated: false,
    }];
    const sys = buildStellarSystem(columns, 1, 'Star1', { 1: real });
    expect(sys.planets).toEqual(real);
    expect(sys.planets[0]!.isReal).toBe(true);
  });
  it('is deterministic for the procedural path', () => {
    expect(buildStellarSystem(columns, 0, 'Sol')).toEqual(buildStellarSystem(columns, 0, 'Sol'));
  });
});

describe('buildStellarSystem solar system', () => {
  const columns = {
    count: 1,
    x: new Float32Array([0]), y: new Float32Array([0]), z: new Float32Array([0]),
    mag: new Float32Array([-26.7]), absmag: new Float32Array([4.85]), ci: new Float32Array([0.656]),
  };
  it('returns the real Solar System for index 0', () => {
    const sys = buildStellarSystem(columns, 0, 'Sol');
    expect(sys.planets.map((p) => p.name)).toEqual(getSolarSystem().map((p) => p.name));
    expect(sys.planets.length).toBe(8);
  });
});
