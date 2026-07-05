import { describe, it, expect } from 'vitest';
import { NavigationController, MIN_VIEW_AU, MAX_VIEW_AU } from '../../src/nav/NavigationController';

describe('NavigationController', () => {
  it('starts focused on the Sun looking down at ~40 AU', () => {
    const n = new NavigationController();
    expect(n.focusStarIndex).toBe(0);
    expect(n.focusWorldAu).toEqual([0, 0, 0]);
    expect(n.viewDistanceAu).toBe(40);
    expect(n.orbitPitch).toBeGreaterThan(0);
  });
  it('zoom multiplies and clamps view distance', () => {
    const n = new NavigationController();
    n.zoom(2); expect(n.viewDistanceAu).toBe(80);
    n.zoom(1e12); expect(n.viewDistanceAu).toBe(MAX_VIEW_AU);
    n.zoom(0); expect(n.viewDistanceAu).toBe(MIN_VIEW_AU);
  });
  it('orbit clamps pitch to +-1.5', () => {
    const n = new NavigationController();
    n.orbit(0.3, 5); expect(n.orbitPitch).toBeCloseTo(1.5, 6);
    n.orbit(0, -20); expect(n.orbitPitch).toBeCloseTo(-1.5, 6);
    n.orbit(1.0, 0); expect(n.orbitYaw).toBeCloseTo(0.3 + 1.0, 6);
  });
  it('translate moves focus in the view plane (yaw 0: W→-Z, D→+X)', () => {
    const n = new NavigationController();
    n.orbitYaw = 0;
    n.translate(1, 0, 10, 1); // forward 1, speed 10, dt 1 → -Z by 10
    expect(n.focusWorldAu[2]).toBeCloseTo(-10, 5);
    expect(n.focusWorldAu[0]).toBeCloseTo(0, 5);
    n.setFocus(0, [0, 0, 0]);
    n.translate(0, 1, 10, 1); // right 1 → +X by 10
    expect(n.focusWorldAu[0]).toBeCloseTo(10, 5);
  });
  it('setFocus replaces index and world position', () => {
    const n = new NavigationController();
    n.setFocus(42, [5, -3, 8]);
    expect(n.focusStarIndex).toBe(42);
    expect(n.focusWorldAu).toEqual([5, -3, 8]);
  });
});
