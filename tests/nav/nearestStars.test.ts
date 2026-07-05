import { describe, it, expect } from 'vitest';
import { nearestStarsPc } from '../../src/nav/nearestStars';

const columns = {
  count: 4,
  x: new Float32Array([0, 1, 5, 2]), y: new Float32Array([0, 0, 0, 0]), z: new Float32Array([0, 0, 0, 0]),
  mag: new Float32Array([1, 1, 1, 1]), absmag: new Float32Array([1, 1, 1, 1]), ci: new Float32Array([0, 0, 0, 0]),
};

describe('nearestStarsPc', () => {
  it('returns the `count` nearest stars in ascending distance', () => {
    const r = nearestStarsPc([0, 0, 0], columns, 2);
    expect(r.map((s) => s.index)).toEqual([0, 1]);
    expect(r[0]!.distPc).toBeCloseTo(0, 6);
    expect(r[1]!.distPc).toBeCloseTo(1, 6);
  });
  it('orders by distance from the focus point, not catalog order', () => {
    const r = nearestStarsPc([5, 0, 0], columns, 2);
    expect(r.map((s) => s.index)).toEqual([2, 3]); // x=5 (d0), x=2 (d3) beats x=1 (d4)
  });
  it('handles count <= 0 and count > star count', () => {
    expect(nearestStarsPc([0, 0, 0], columns, 0)).toEqual([]);
    expect(nearestStarsPc([0, 0, 0], columns, 99).length).toBe(4);
  });
});
