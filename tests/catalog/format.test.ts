import { describe, it, expect } from 'vitest';
import { encodeCatalog, decodeCatalog, MAGIC, VERSION } from '../../src/catalog/format';

function sample() {
  return {
    count: 2,
    x: new Float32Array([1, -4]),
    y: new Float32Array([2, 5]),
    z: new Float32Array([3, -6]),
    mag: new Float32Array([-1.46, 0.5]),
    absmag: new Float32Array([1.42, 4.8]),
    ci: new Float32Array([0.0, 0.63]),
  };
}

describe('catalog format', () => {
  it('round-trips columns', () => {
    const buf = encodeCatalog(sample());
    const out = decodeCatalog(buf);
    expect(out.count).toBe(2);
    expect(Array.from(out.z)).toEqual([3, -6]);
    expect(out.ci[1]).toBeCloseTo(0.63, 5);
  });

  it('writes magic and version in header', () => {
    const buf = encodeCatalog(sample());
    const view = new DataView(buf);
    expect(view.getUint32(0, true)).toBe(MAGIC);
    expect(view.getUint32(4, true)).toBe(VERSION);
    expect(view.getUint32(8, true)).toBe(2);
  });

  it('rejects wrong magic', () => {
    const buf = new ArrayBuffer(12);
    expect(() => decodeCatalog(buf)).toThrow(/magic/i);
  });
});
