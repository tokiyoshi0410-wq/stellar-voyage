import { describe, it, expect } from 'vitest';
import { buildGalaxyGeometry } from '../../src/galaxy/GalaxyDisk';
import { MILKY_WAY } from '../../src/galaxy/galaxyParams';

describe('buildGalaxyGeometry', () => {
  it('is deterministic for a given seed', () => {
    const a = buildGalaxyGeometry(MILKY_WAY, 1);
    const b = buildGalaxyGeometry(MILKY_WAY, 1);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.colors)).toEqual(Array.from(b.colors));
  });
  it('produces count-sized arrays', () => {
    const g = buildGalaxyGeometry(MILKY_WAY, 1);
    expect(g.positions.length).toBe(MILKY_WAY.count * 3);
    expect(g.colors.length).toBe(MILKY_WAY.count * 3);
    expect(g.sizes.length).toBe(MILKY_WAY.count);
  });
  it('keeps every point within radius*1.05 and thickness', () => {
    const g = buildGalaxyGeometry(MILKY_WAY, 1);
    for (let i = 0; i < MILKY_WAY.count; i++) {
      const x = g.positions[i * 3]!, y = g.positions[i * 3 + 1]!, z = g.positions[i * 3 + 2]!;
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(MILKY_WAY.radiusAu * 1.05);
      expect(Math.abs(y)).toBeLessThanOrEqual(MILKY_WAY.thicknessAu);
    }
  });
  it('clamps all color components to [0,1]', () => {
    const g = buildGalaxyGeometry(MILKY_WAY, 1);
    for (const c of g.colors) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(1); }
  });
  it('places bulge points (first fraction) near the center', () => {
    const g = buildGalaxyGeometry(MILKY_WAY, 1);
    const bulge = Math.floor(MILKY_WAY.count * MILKY_WAY.bulgeFraction);
    for (let i = 0; i < bulge; i++) {
      const x = g.positions[i * 3]!, y = g.positions[i * 3 + 1]!, z = g.positions[i * 3 + 2]!;
      expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(MILKY_WAY.radiusAu * 0.15 + 1);
    }
  });
});
