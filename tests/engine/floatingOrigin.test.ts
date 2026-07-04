import { describe, it, expect } from 'vitest';
import { FloatingOrigin } from '../../src/engine/FloatingOrigin';

describe('FloatingOrigin', () => {
  it('accumulates translation in double precision', () => {
    const o = new FloatingOrigin();
    o.translate(1000, 0, 0);
    o.translate(0.0001, 0, 0);
    expect(o.position[0]).toBeCloseTo(1000.0001, 6);
  });

  it('relative() subtracts camera position', () => {
    const o = new FloatingOrigin();
    o.setPosition(500, -200, 30);
    expect(o.relative(510, -180, 30)).toEqual([10, 20, 0]);
  });

  it('keeps sub-parsec precision near a distant star', () => {
    const o = new FloatingOrigin();
    o.setPosition(3000, 0, 0);
    const rel = o.relative(3000.5, 0, 0);
    expect(rel[0]).toBeCloseTo(0.5, 6);
  });
});
