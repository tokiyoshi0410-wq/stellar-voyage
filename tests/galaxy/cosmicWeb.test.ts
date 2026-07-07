import { describe, it, expect } from 'vitest';
import { buildCosmicWeb } from '../../src/galaxy/cosmicWeb';

const P = { count: 2000, radiusAu: 5e11, nodeCount: 30 };

describe('buildCosmicWeb', () => {
  it('produces count galaxies with matching color/size buffer lengths', () => {
    const g = buildCosmicWeb(7, P);
    expect(g.positions.length).toBe(P.count * 3);
    expect(g.colors.length).toBe(P.count * 3);
    expect(g.sizes.length).toBe(P.count);
  });

  it('is deterministic for the same seed (reproducible across reloads)', () => {
    const a = buildCosmicWeb(7, P);
    const b = buildCosmicWeb(7, P);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.colors)).toEqual(Array.from(b.colors));
  });

  it('differs for a different seed', () => {
    const a = buildCosmicWeb(7, P);
    const b = buildCosmicWeb(8, P);
    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions));
  });

  it('keeps all galaxies within the web radius (with a small filament/scatter margin)', () => {
    const g = buildCosmicWeb(7, P);
    for (let i = 0; i < P.count; i++) {
      const d = Math.hypot(g.positions[i * 3]!, g.positions[i * 3 + 1]!, g.positions[i * 3 + 2]!);
      expect(d).toBeLessThanOrEqual(P.radiusAu * 1.5);
    }
  });

  it('places a dense node at the origin (our cluster) — some galaxies near the center', () => {
    const g = buildCosmicWeb(7, P);
    let nearCenter = 0;
    for (let i = 0; i < P.count; i++) {
      const d = Math.hypot(g.positions[i * 3]!, g.positions[i * 3 + 1]!, g.positions[i * 3 + 2]!);
      if (d < P.radiusAu * 0.1) nearCenter++;
    }
    expect(nearCenter).toBeGreaterThan(0);
  });

  it('colors and sizes are finite and in sane ranges', () => {
    const g = buildCosmicWeb(7, P);
    for (let i = 0; i < P.count; i++) {
      expect(g.sizes[i]!).toBeGreaterThan(0);
      expect(Number.isFinite(g.positions[i * 3]!)).toBe(true);
      for (let c = 0; c < 3; c++) {
        const v = g.colors[i * 3 + c]!;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});
