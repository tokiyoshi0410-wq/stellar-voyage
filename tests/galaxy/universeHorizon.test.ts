import { describe, it, expect } from 'vitest';
import { buildHorizonShell } from '../../src/galaxy/universeHorizon';

const P = { count: 3000, radiusAu: 3e12, thicknessAu: 3e11 };

describe('buildHorizonShell', () => {
  it('produces count points with matching color/size lengths', () => {
    const g = buildHorizonShell(5, P);
    expect(g.positions.length).toBe(P.count * 3);
    expect(g.colors.length).toBe(P.count * 3);
    expect(g.sizes.length).toBe(P.count);
  });
  it('is deterministic for the same seed', () => {
    const a = buildHorizonShell(5, P);
    const b = buildHorizonShell(5, P);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
  });
  it('places every point on the shell (radius ≈ radiusAu within thickness)', () => {
    const g = buildHorizonShell(5, P);
    for (let i = 0; i < P.count; i++) {
      const d = Math.hypot(g.positions[i * 3]!, g.positions[i * 3 + 1]!, g.positions[i * 3 + 2]!);
      expect(d).toBeGreaterThan(P.radiusAu - P.thicknessAu);
      expect(d).toBeLessThan(P.radiusAu + P.thicknessAu);
    }
  });
  it('covers the whole sphere (points in every octant)', () => {
    const g = buildHorizonShell(5, P);
    const octants = new Set<string>();
    for (let i = 0; i < P.count; i++) {
      const sx = g.positions[i * 3]! >= 0 ? '+' : '-';
      const sy = g.positions[i * 3 + 1]! >= 0 ? '+' : '-';
      const sz = g.positions[i * 3 + 2]! >= 0 ? '+' : '-';
      octants.add(sx + sy + sz);
    }
    expect(octants.size).toBe(8);
  });
  it('colors and sizes are finite and in sane ranges', () => {
    const g = buildHorizonShell(5, P);
    for (let i = 0; i < P.count; i++) {
      expect(g.sizes[i]!).toBeGreaterThan(0);
      for (let c = 0; c < 3; c++) {
        const v = g.colors[i * 3 + c]!;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});
