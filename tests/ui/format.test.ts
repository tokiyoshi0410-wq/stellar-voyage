import { describe, it, expect } from 'vitest';
import {
  formatSpeed, formatDistanceLy, describeStar, formatAuDistance,
} from '../../src/ui/format';

describe('formatSpeed', () => {
  it('shows km/s below light speed', () => {
    expect(formatSpeed(0.5)).toMatch(/km\/s/);
  });
  it('shows multiples of c at or above 1', () => {
    expect(formatSpeed(1000)).toMatch(/×c|c$/);
  });
});

describe('formatDistanceLy', () => {
  it('converts parsecs to light years', () => {
    expect(formatDistanceLy(1)).toMatch(/3\.26/);
    expect(formatDistanceLy(1)).toMatch(/光年/);
  });
});

describe('describeStar', () => {
  const columns = {
    count: 1,
    x: new Float32Array([2.6]), y: new Float32Array([0]), z: new Float32Array([0]),
    mag: new Float32Array([-1.44]), absmag: new Float32Array([1.45]),
    ci: new Float32Array([0.0]),
  };
  it('uses proper name as title when present', () => {
    const info = describeStar(columns, 0, 'Sirius');
    expect(info.title).toBe('Sirius');
    expect(info.isReal).toBe(true);
  });
  it('falls back to HYG index when unnamed', () => {
    const info = describeStar(columns, 0, null);
    expect(info.title).toBe('HYG #0');
  });
  it('computes spectral class and positive distance', () => {
    const info = describeStar(columns, 0, 'Sirius');
    expect(['O','B','A','F','G','K','M']).toContain(info.spectralClass);
    expect(info.distanceLy).toBeGreaterThan(0);
  });
});

describe('formatAuDistance', () => {
  it('shows AU and 億km for Earth (1 AU ≈ 1.5億km)', () => {
    const s = formatAuDistance(1.0);
    expect(s).toMatch(/1\.0 AU/);
    expect(s).toMatch(/1\.5億km/);
  });
  it('formats inner and outer planets sensibly', () => {
    expect(formatAuDistance(0.39)).toMatch(/0\.39 AU/);
    expect(formatAuDistance(30.1)).toMatch(/30 AU/);
  });
});
