import { describe, it, expect } from 'vitest';
import { barStops, barRightAu, barFraction, reachedStop, barReadoutText } from '../../src/edu/lightBar';

describe('barStops', () => {
  it('lists outer planets by Earth distance, Mars first … Neptune last', () => {
    const s = barStops();
    expect(s.map((x) => x.name)).toEqual(['火星', '木星', '土星', '天王星', '海王星']);
    for (let i = 1; i < s.length; i++) {
      expect(s[i]!.earthDistAu).toBeGreaterThan(s[i - 1]!.earthDistAu);
    }
    // 木星は地球から 4.2 AU（5.2 - 1）
    expect(s.find((x) => x.name === '木星')!.earthDistAu).toBeCloseTo(4.2, 5);
  });
});

describe('barRightAu', () => {
  it('is the farthest stop (Neptune ≈ 29.1 AU from Earth)', () => {
    expect(barRightAu(barStops())).toBeCloseTo(29.1, 1);
  });
});

describe('barFraction', () => {
  it('maps 0→0, right→1, midpoint→0.5, and clamps beyond', () => {
    expect(barFraction(0, 29)).toBe(0);
    expect(barFraction(29, 29)).toBe(1);
    expect(barFraction(58, 29)).toBe(1);
    expect(barFraction(14.5, 29)).toBeCloseTo(0.5, 5);
  });
});

describe('reachedStop', () => {
  it('returns the farthest reached stop (inclusive) or null before the first', () => {
    const s = barStops();
    expect(reachedStop(0.1, s)).toBe(null);          // 火星(0.52)未満
    expect(reachedStop(0.52, s)!.name).toBe('火星');  // 境界含む
    expect(reachedStop(5, s)!.name).toBe('木星');     // 木星(4.2)超・土星(8.58)未満
    expect(reachedStop(100, s)!.name).toBe('海王星');
  });
});

describe('barReadoutText', () => {
  it('shows elapsed light time and reached planet', () => {
    const s = barStops();
    expect(barReadoutText(4.2, s)).toMatch(/光の経過時間:/);
    expect(barReadoutText(4.2, s)).toMatch(/木星に到達/);
    expect(barReadoutText(0.1, s)).not.toMatch(/に到達/); // 未到達
  });
});
