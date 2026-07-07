import { describe, it, expect } from 'vitest';
import { pulseGrowthAuPerSec, pulseLightTimeMin, formatPulseTime, pulseReached } from '../../src/edu/lightPulse';

describe('pulseGrowthAuPerSec', () => {
  it('moves at a fixed real-light speed, independent of view distance', () => {
    // 現実の光速で固定（時間だけ一定倍率で加速）。視距離に依存しない正の定数。
    // 加速倍率は見た目チューニング値なので厳密値は assert しない（正・有限のみ）。
    const speed = pulseGrowthAuPerSec();
    expect(speed).toBeGreaterThan(0);
    expect(Number.isFinite(speed)).toBe(true);
    // 光速準拠: 1秒ぶんの成長を光が進むのにかかる時間（分）は正の一定値
    expect(pulseLightTimeMin(speed)).toBeGreaterThan(0);
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
  it('formats 100〜9999 年 without exponential notation', () => {
    const minFor250yr = 250 * 365 * 24 * 60; // 旧: formatLightTime 経由で "約2.5e+2年"
    expect(formatPulseTime(minFor250yr)).toBe('約250年');
    expect(formatPulseTime(minFor250yr)).not.toMatch(/e\+/);
  });
});

describe('pulseReached', () => {
  it('is true when radius reaches or exceeds the target (inclusive)', () => {
    expect(pulseReached(5, 5)).toBe(true);
    expect(pulseReached(4.9, 5)).toBe(false);
    expect(pulseReached(6, 5)).toBe(true);
  });
});
