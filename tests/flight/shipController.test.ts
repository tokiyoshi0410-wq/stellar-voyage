import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ShipController, NORMAL_BAND, MAX_WARP_C } from '../../src/flight/ShipController';
import { FloatingOrigin } from '../../src/engine/FloatingOrigin';

describe('ShipController.throttleToSpeedC', () => {
  const ship = new ShipController(new FloatingOrigin());

  it('is zero at zero throttle', () => {
    expect(ship.throttleToSpeedC(0)).toBe(0);
  });

  it('reaches ~0.999c at end of normal band', () => {
    expect(ship.throttleToSpeedC(NORMAL_BAND)).toBeCloseTo(0.999, 3);
  });

  it('is monotonically increasing', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const s = ship.throttleToSpeedC(Math.min(t, 1));
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it('reaches MAX_WARP_C at full throttle', () => {
    expect(ship.throttleToSpeedC(1)).toBeCloseTo(MAX_WARP_C, 0);
  });
});

describe('ShipController.update', () => {
  it('moves the origin forward along -Z by default orientation', () => {
    const origin = new FloatingOrigin();
    const ship = new ShipController(origin);
    ship.throttle = NORMAL_BAND; // ~0.999c
    ship.update(1);
    // 前方 -Z に進む。距離 = 0.999 * C_PC_PER_S * TIME_COMPRESSION pc（約 0.306 pc）
    expect(origin.position[2]).toBeLessThan(0);
    expect(Math.abs(origin.position[2])).toBeGreaterThan(0.2);
  });

  it('does not move at zero throttle', () => {
    const origin = new FloatingOrigin();
    const ship = new ShipController(origin);
    ship.update(1);
    expect(origin.position).toEqual([0, 0, 0]);
  });

  it('flags warp above the normal band', () => {
    const ship = new ShipController(new FloatingOrigin());
    ship.throttle = 0.9;
    expect(ship.isWarp).toBe(true);
    ship.throttle = 0.5;
    expect(ship.isWarp).toBe(false);
  });
});
