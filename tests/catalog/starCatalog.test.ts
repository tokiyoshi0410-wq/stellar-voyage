import { describe, it, expect } from 'vitest';
import { StarCatalog } from '../../src/catalog/StarCatalog';

const columns = {
  count: 2,
  x: new Float32Array([0, 1]), y: new Float32Array([0, 2]), z: new Float32Array([0, 3]),
  mag: new Float32Array([-1.4, 0.5]), absmag: new Float32Array([1.4, 4.8]),
  ci: new Float32Array([0.0, 0.63]),
};

describe('StarCatalog', () => {
  it('exposes name lookup', () => {
    const cat = StarCatalog.fromData(columns, { 1: 'Sirius' });
    expect(cat.nameOf(1)).toBe('Sirius');
    expect(cat.nameOf(0)).toBeNull();
  });
});
