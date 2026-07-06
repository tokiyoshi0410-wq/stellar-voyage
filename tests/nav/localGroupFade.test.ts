import { describe, it, expect } from 'vitest';
import { localGroupFade, andromedaFade, localGroupOpacities } from '../../src/nav/localGroupFade';

describe('localGroupFade', () => {
  it('is 0 at or below the start (3e9)', () => {
    expect(localGroupFade(3e9)).toBe(0);
    expect(localGroupFade(1e9)).toBe(0);
  });
  it('is 1 at or above the end (1e10)', () => {
    expect(localGroupFade(1e10)).toBe(1);
    expect(localGroupFade(5e10)).toBe(1);
  });
  it('is ~0.5 at the band midpoint (6.5e9)', () => {
    expect(localGroupFade(6.5e9)).toBeCloseTo(0.5, 5);
  });
  it('increases monotonically across the band', () => {
    let prev = -1;
    for (let v = 3e9; v <= 1e10; v += 5e8) {
      const f = localGroupFade(v);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });
});

describe('andromedaFade', () => {
  it('is 0 at or below the start (2e10)', () => {
    expect(andromedaFade(2e10)).toBe(0);
    expect(andromedaFade(1e10)).toBe(0);
  });
  it('is 1 at or above the end (3.5e10)', () => {
    expect(andromedaFade(3.5e10)).toBe(1);
    expect(andromedaFade(5e10)).toBe(1);
  });
  it('increases monotonically across the band', () => {
    let prev = -1;
    for (let v = 2e10; v <= 3.5e10; v += 5e8) {
      const f = andromedaFade(v);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });
});

describe('localGroupOpacities', () => {
  it('shows neither galaxy below the localgroup stage', () => {
    const o = localGroupOpacities(1e9);
    expect(o.milkyWay).toBe(0);
    expect(o.andromeda).toBe(0);
  });
  it('shows the Milky Way (not Andromeda) in the milky-way band', () => {
    const o = localGroupOpacities(1.5e10);
    expect(o.milkyWay).toBeGreaterThan(0.9);
    expect(o.andromeda).toBeLessThan(0.1);
  });
  it('shows Andromeda (not the Milky Way) at maximum zoom-out', () => {
    const o = localGroupOpacities(5e10);
    expect(o.milkyWay).toBeCloseTo(0, 5);
    expect(o.andromeda).toBeCloseTo(1, 5);
  });
  it('crossfades: dominance swaps from Milky Way to Andromeda across the band', () => {
    const near = localGroupOpacities(2.2e10); // MW 優勢
    const far = localGroupOpacities(3.3e10);  // Andromeda 優勢
    expect(near.milkyWay).toBeGreaterThan(near.andromeda);
    expect(far.andromeda).toBeGreaterThan(far.milkyWay);
  });
});
