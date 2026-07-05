import { describe, it, expect } from 'vitest';
import { starRelativeAu } from '../../src/nav/starRelative';

describe('starRelativeAu', () => {
  it('is (posPc - focusPc) * scale - cameraAu', () => {
    const r = starRelativeAu([2, 0, 0], [1, 0, 0], 100, [10, 0, 0]);
    expect(r).toEqual([100 - 10, 0, 0]); // (2-1)*100 - 10 = 90
  });
  it('focus star at focus maps near camera origin offset', () => {
    const r = starRelativeAu([5, 5, 5], [5, 5, 5], 206264.8, [0, 0, 0]);
    expect(r).toEqual([0, 0, 0]);
  });
});
