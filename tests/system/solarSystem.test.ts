import { describe, it, expect } from 'vitest';
import { getSolarSystem } from '../../src/system/solarSystem';

describe('getSolarSystem', () => {
  const s = getSolarSystem();
  it('has the 8 planets in ascending orbit order', () => {
    expect(s.length).toBe(8);
    expect(s.map((p) => p.name)).toEqual(['水星','金星','地球','火星','木星','土星','天王星','海王星']);
    let prev = 0;
    for (const p of s) { expect(p.semiMajorAxisAu).toBeGreaterThan(prev); prev = p.semiMajorAxisAu; }
  });
  it('earth is in the habitable zone, mars and venus are not', () => {
    const by = (n: string) => s.find((p) => p.name === n)!;
    expect(by('地球').inHabitableZone).toBe(true);
    expect(by('火星').inHabitableZone).toBe(false);
    expect(by('金星').inHabitableZone).toBe(false);
  });
  it('assigns sensible types and only Saturn has a ring', () => {
    const by = (n: string) => s.find((p) => p.name === n)!;
    expect(by('地球').type).toBe('ocean');
    expect(by('木星').type).toBe('gas');
    expect(by('海王星').type).toBe('ice');
    expect(s.filter((p) => p.hasRing).map((p) => p.name)).toEqual(['土星']);
    for (const p of s) { expect(p.isReal).toBe(true); expect(p.radiusEarth).toBeGreaterThan(0); }
  });
});
