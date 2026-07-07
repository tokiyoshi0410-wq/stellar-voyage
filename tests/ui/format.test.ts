import { describe, it, expect } from 'vitest';
import {
  formatSpeed, formatDistanceLy, describeStar, formatAuDistance, starDisplayName,
  formatLuminosity, formatLy,
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
  it('avoids exponential notation for far planets (a > 66 AU)', () => {
    const s = formatAuDistance(160); // 160×1.496=239.4 → 旧実装は "2.4e+2億km"
    expect(s).not.toMatch(/e\+/);
    expect(s).toMatch(/240億km/);
  });
});

describe('formatLuminosity', () => {
  it('uses comma-grouped integers for very bright stars (no exponent)', () => {
    expect(formatLuminosity(136000)).toBe('136,000'); // デネブ級 → 旧 toPrecision(3) は "1.36e+5"
  });
  it('keeps ordinary luminosities readable', () => {
    expect(formatLuminosity(1)).toBe('1');
    expect(formatLuminosity(1.36)).toBe('1.36');
  });
});

describe('formatLy', () => {
  it('keeps one decimal for near stars and rounds far ones', () => {
    expect(formatLy(4.24)).toBe('4.2 光年'); // プロキシマ（旧 Math.round は "4 光年"）
    expect(formatLy(860)).toBe('860 光年');
  });
});

describe('starDisplayName', () => {
  it('renders the Sun (index 0) as 太陽 regardless of catalog name', () => {
    expect(starDisplayName(0, 'Sol')).toBe('太陽');
    expect(starDisplayName(0, null)).toBe('太陽');
  });
  it('uses the proper name for other stars, falling back to HYG #index', () => {
    expect(starDisplayName(5, 'Sirius')).toBe('Sirius');
    expect(starDisplayName(42, null)).toBe('HYG #42');
  });
});
