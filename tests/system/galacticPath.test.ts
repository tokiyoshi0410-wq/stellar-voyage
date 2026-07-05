import { describe, it, expect } from 'vitest';
import {
  galacticPathPoint, galacticMarkerParam, GAL_ARC_SPAN, systemTravelParam,
} from '../../src/system/galacticPath';

describe('galacticPathPoint', () => {
  it('puts the Sun (a=0) at the origin', () => {
    expect(galacticPathPoint(0)).toEqual([0, 0, 0]);
  });
  it('matches the arc formula at a=π/3', () => {
    const [x, y, z] = galacticPathPoint(Math.PI / 3, 40);
    expect(x).toBeCloseTo(40 * Math.sin(Math.PI / 3), 9);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(-40 + 40 * Math.cos(Math.PI / 3), 9);
  });
});

describe('galacticMarkerParam', () => {
  it('stays within (-π/3, π/3]', () => {
    for (let k = 0; k < 6; k++) {
      for (const t of [0, 1, 3.3, 10, 50]) {
        const p = galacticMarkerParam(k, 6, t, 0.15);
        expect(p).toBeGreaterThan(-Math.PI / 3 - 1e-9);
        expect(p).toBeLessThanOrEqual(Math.PI / 3 + 1e-9);
      }
    }
  });
  it('spaces markers evenly at t=0', () => {
    const p0 = galacticMarkerParam(0, 6, 0, 0.15);
    const p1 = galacticMarkerParam(1, 6, 0, 0.15);
    const p2 = galacticMarkerParam(2, 6, 0, 0.15);
    expect(p0 - p1).toBeCloseTo(p1 - p2, 9);
  });
  it('flows backward: param decreases as t increases (before wrap)', () => {
    expect(galacticMarkerParam(0, 6, 0.5, 0.15)).toBeLessThan(galacticMarkerParam(0, 6, 0, 0.15));
  });
  it('loops with period GAL_ARC_SPAN / flowSpeed', () => {
    const period = GAL_ARC_SPAN / 0.15;
    expect(galacticMarkerParam(2, 6, 1 + period, 0.15)).toBeCloseTo(galacticMarkerParam(2, 6, 1, 0.15), 9);
  });
});

describe('systemTravelParam', () => {
  it('starts centered (0) at t=0', () => {
    expect(systemTravelParam(0, 0.05)).toBeCloseTo(0, 9);
  });
  it('stays within [-π/3, π/3]', () => {
    for (const t of [0, 1, 5, 13, 40, 100]) {
      const p = systemTravelParam(t, 0.05);
      expect(p).toBeGreaterThanOrEqual(-Math.PI / 3 - 1e-9);
      expect(p).toBeLessThanOrEqual(Math.PI / 3 + 1e-9);
    }
  });
  it('moves toward -π/3 as t increases (before wrap)', () => {
    expect(systemTravelParam(1, 0.05)).toBeLessThan(systemTravelParam(0, 0.05));
  });
  it('loops with period GAL_ARC_SPAN / speed', () => {
    const period = GAL_ARC_SPAN / 0.05;
    expect(systemTravelParam(2 + period, 0.05)).toBeCloseTo(systemTravelParam(2, 0.05), 9);
  });
});
