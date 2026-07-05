import { describe, it, expect } from 'vitest';
import { systemFade } from '../../src/nav/fade';

describe('systemFade', () => {
  it('is 1 when close and 0 when far', () => {
    expect(systemFade(100)).toBe(1);
    expect(systemFade(300)).toBeCloseTo(1, 6);
    expect(systemFade(30000)).toBeCloseTo(0, 6);
    expect(systemFade(100000)).toBe(0);
  });
  it('decreases monotonically across the band', () => {
    let prev = 1.0001;
    for (let d = 300; d <= 30000; d += 2000) { const f = systemFade(d); expect(f).toBeLessThanOrEqual(prev); prev = f; }
  });
});
