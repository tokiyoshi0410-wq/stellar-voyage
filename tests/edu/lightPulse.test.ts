import { describe, it, expect } from 'vitest';
import { pulseGrowthAuPerSec, pulseLightTimeMin, formatPulseTime, pulseReached } from '../../src/edu/lightPulse';

describe('pulseGrowthAuPerSec', () => {
  it('is positive and proportional to view distance (constant screen tempo)', () => {
    expect(pulseGrowthAuPerSec(10)).toBeGreaterThan(0);
    expect(pulseGrowthAuPerSec(100)).toBeGreaterThan(pulseGrowthAuPerSec(10));
    // 画面基準で一定に見えるよう視距離に比例（10倍の視距離→10倍の速度）
    expect(pulseGrowthAuPerSec(100)).toBeCloseTo(pulseGrowthAuPerSec(10) * 10, 5);
  });
});

describe('pulseLightTimeMin', () => {
  it('is 8.317 min at 1 AU and proportional to radius', () => {
    expect(pulseLightTimeMin(1)).toBeCloseTo(8.317, 3);
    expect(pulseLightTimeMin(2)).toBeCloseTo(pulseLightTimeMin(1) * 2, 5);
    expect(pulseLightTimeMin(0)).toBe(0);
  });
});

describe('formatPulseTime', () => {
  it('reuses formatLightTime below 1万年 and switches to 万年 above', () => {
    expect(formatPulseTime(pulseLightTimeMin(1))).toBe('8分19秒');       // 地球=1AU
    const fourLyMin = 4.2 * 365 * 24 * 60;                                // 4.2光年ぶんの光行時間(分)
    expect(formatPulseTime(fourLyMin)).toMatch(/約4\.2年/);
    const hundredThousandYrMin = 100000 * 365 * 24 * 60;
    expect(formatPulseTime(hundredThousandYrMin)).toBe('約10万年');
  });
});

describe('pulseReached', () => {
  it('is true when radius reaches or exceeds the target (inclusive)', () => {
    expect(pulseReached(5, 5)).toBe(true);
    expect(pulseReached(4.9, 5)).toBe(false);
    expect(pulseReached(6, 5)).toBe(true);
  });
});
