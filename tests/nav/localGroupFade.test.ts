import { describe, it, expect } from 'vitest';
import { localGroupFade } from '../../src/nav/localGroupFade';

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
