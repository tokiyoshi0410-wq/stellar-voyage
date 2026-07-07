import { describe, it, expect } from 'vitest';
import { pinchDistance, pinchZoomFactor } from '../../src/nav/pinch';

describe('pinchDistance', () => {
  it('is the euclidean distance between two touch points', () => {
    expect(pinchDistance(0, 0, 3, 4)).toBe(5);
    expect(pinchDistance(10, 10, 10, 10)).toBe(0);
  });
});

describe('pinchZoomFactor', () => {
  it('spreading fingers (cur > prev) zooms in → factor < 1', () => {
    expect(pinchZoomFactor(100, 200)).toBeCloseTo(0.5, 6);
  });
  it('closing fingers (cur < prev) zooms out → factor > 1', () => {
    expect(pinchZoomFactor(200, 100)).toBeCloseTo(2, 6);
  });
  it('no change → factor 1', () => {
    expect(pinchZoomFactor(150, 150)).toBe(1);
  });
  it('guards against zero/negative distances (returns 1)', () => {
    expect(pinchZoomFactor(0, 100)).toBe(1);
    expect(pinchZoomFactor(100, 0)).toBe(1);
    expect(pinchZoomFactor(-5, 100)).toBe(1);
  });
});
