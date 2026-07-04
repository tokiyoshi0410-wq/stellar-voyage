import { describe, it, expect } from 'vitest';
import { snowLineAu, classifyPlanetType, generatePlanets } from '../../src/system/planetGen';

describe('classifyPlanetType', () => {
  it('outside the snow line is gas or ice', () => {
    const snow = snowLineAu(1); // ~2.7 AU
    expect(['gas', 'ice']).toContain(classifyPlanetType(snow + 1, 1, 0.2));
    expect(['gas', 'ice']).toContain(classifyPlanetType(snow + 1, 1, 0.8));
  });
  it('inside the snow line is rock or ocean', () => {
    expect(['rock', 'ocean']).toContain(classifyPlanetType(1.0, 1, 0.2));
    expect(['rock', 'ocean']).toContain(classifyPlanetType(0.3, 1, 0.9));
  });
});

describe('generatePlanets', () => {
  it('is deterministic for a given star index', () => {
    const a = generatePlanets(42, 'G', 1);
    const b = generatePlanets(42, 'G', 1);
    expect(a).toEqual(b);
  });
  it('different indices give different systems (usually)', () => {
    const a = generatePlanets(1, 'G', 1);
    const b = generatePlanets(2, 'G', 1);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
  it('planets have valid fields and increasing orbits', () => {
    const ps = generatePlanets(99, 'K', 0.4);
    let prev = 0;
    for (const p of ps) {
      expect(p.semiMajorAxisAu).toBeGreaterThan(prev); prev = p.semiMajorAxisAu;
      expect(p.radiusEarth).toBeGreaterThan(0);
      expect(p.massEarth).toBeGreaterThan(0);
      expect(['rock', 'ocean', 'gas', 'ice']).toContain(p.type);
      expect(p.isReal).toBe(false);
    }
  });
});
