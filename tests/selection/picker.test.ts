import { describe, it, expect } from 'vitest';
import { pickStar } from '../../src/selection/Picker';

const columns = {
  count: 3,
  x: new Float32Array([10, 0, -10]),
  y: new Float32Array([0, 10, 0]),
  z: new Float32Array([0, 0, 0]),
  mag: new Float32Array([1, 1, 1]), absmag: new Float32Array([1, 1, 1]),
  ci: new Float32Array([0, 0, 0]),
};

describe('pickStar', () => {
  it('selects the star aligned with the ray', () => {
    const idx = pickStar([0, 0, 0], [1, 0, 0], columns, 0.1);
    expect(idx).toBe(0);
  });

  it('selects the +Y star when looking up', () => {
    const idx = pickStar([0, 0, 0], [0, 1, 0], columns, 0.1);
    expect(idx).toBe(1);
  });

  it('returns null when nothing is within the angle threshold', () => {
    const idx = pickStar([0, 0, 0], [0, 0, 1], columns, 0.1);
    expect(idx).toBeNull();
  });

  it('accounts for camera position', () => {
    const idx = pickStar([9, 0, 0], [1, 0, 0], columns, 0.1);
    expect(idx).toBe(0); // star0 at x=10 is directly ahead
  });
});
