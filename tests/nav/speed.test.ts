import { describe, it, expect } from 'vitest';
import { speedFromSlider, formatSpeed, MIN_SPEED_AU_S, MAX_SPEED_AU_S } from '../../src/nav/speed';

describe('speedFromSlider', () => {
  it('maps 0→MIN and 1→MAX on a log scale, monotonic', () => {
    expect(speedFromSlider(0)).toBeCloseTo(MIN_SPEED_AU_S, 5);
    expect(speedFromSlider(1)).toBeCloseTo(MAX_SPEED_AU_S, 0);
    expect(speedFromSlider(0.5)).toBeGreaterThan(speedFromSlider(0.25));
  });
});
describe('formatSpeed', () => {
  it('shows AU/s when slow and 光年/s when fast, in Japanese', () => {
    expect(formatSpeed(2)).toMatch(/AU\/秒/);
    expect(formatSpeed(500000)).toMatch(/光年\/秒/);
  });
});
