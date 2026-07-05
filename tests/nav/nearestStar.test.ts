import { describe, it, expect } from 'vitest';
import { nearestStarPc } from '../../src/nav/nearestStar';

const columns = {
  count: 3,
  x: new Float32Array([0, 10, 3]), y: new Float32Array([0, 0, 0]), z: new Float32Array([0, 0, 0]),
  mag: new Float32Array([1, 1, 1]), absmag: new Float32Array([1, 1, 1]), ci: new Float32Array([0, 0, 0]),
};

describe('nearestStarPc', () => {
  it('returns the closest star index and its distance', () => {
    const r = nearestStarPc([2.9, 0, 0], columns);
    expect(r.index).toBe(2); // star at x=3 is closest to 2.9
    expect(r.distPc).toBeCloseTo(0.1, 5);
  });
  it('returns index 0 (Sun) at the origin', () => {
    expect(nearestStarPc([0, 0, 0], columns).index).toBe(0);
  });
});
