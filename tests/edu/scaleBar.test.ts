import { describe, it, expect } from 'vitest';
import { scaleBarFor, niceRound } from '../../src/edu/scaleBar';

describe('niceRound', () => {
  it('rounds down to the nearest 1/2/5 × 10^n', () => {
    expect(niceRound(7.4)).toBe(5);
    expect(niceRound(12)).toBe(10);
    expect(niceRound(3)).toBe(2);
    expect(niceRound(0.0092)).toBeCloseTo(0.005, 6);
  });
});

describe('scaleBarFor', () => {
  const FOV = (60 * Math.PI) / 180;
  it('uses AU (with 億km + light-time) at solar zoom, width within [32,160]', () => {
    const b = scaleBarFor(40, 1000, FOV);
    expect(b.label).toMatch(/AU/);
    expect(b.label).toMatch(/億km/);
    expect(b.label).toMatch(/分|時間|日/);
    expect(b.widthPx).toBeGreaterThan(31);
    expect(b.widthPx).toBeLessThanOrEqual(160);
  });
  it('switches to 光年 at galaxy zoom', () => {
    const b = scaleBarFor(1e6, 1000, FOV);
    expect(b.label).toMatch(/光年/);
    expect(b.label).not.toMatch(/AU/);
  });
  it('switches to 万光年 at local-group zoom', () => {
    const b = scaleBarFor(1e10, 1000, FOV);
    expect(b.label).toMatch(/万光年/);
  });
  it('formats 億km in plain (non-exponential) notation for large AU values', () => {
    const b = scaleBarFor(649, 1000, FOV); // niceAu ≈ 100 → 億km would be "1.5e+2" without the fix
    expect(b.label).toMatch(/100 AU/);
    expect(b.label).toMatch(/150億km/);
    expect(b.label).not.toMatch(/e\+/);
  });
  it('shows seconds (not "光で 0分") when the light-time is under a minute', () => {
    const b = scaleBarFor(0.05, 1000, FOV); // 最深ズーム: niceAu=0.005 → 光で ~2秒
    expect(b.label).toMatch(/秒/);
    expect(b.label).not.toMatch(/0分/);
  });
  it('keeps tiny 億km values precise (no lossy 3-fraction-digit truncation)', () => {
    const b = scaleBarFor(0.05, 1000, FOV); // 0.005 AU × 1.496 = 0.00748 → "0.0075億km"（"0.008"に丸めない）
    expect(b.label).toMatch(/0\.0075億km/);
  });
});
