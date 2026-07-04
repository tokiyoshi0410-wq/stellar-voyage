import { describe, it, expect } from 'vitest';
import { orbitCameraPosition } from '../../src/nav/orbitCamera';

describe('orbitCameraPosition', () => {
  it('at yaw0/pitch0 sits at focus + (0,0,distance) looking at focus', () => {
    const { position, target } = orbitCameraPosition([1, 2, 3], 0, 0, 10);
    expect(position[0]).toBeCloseTo(1, 6);
    expect(position[1]).toBeCloseTo(2, 6);
    expect(position[2]).toBeCloseTo(13, 6);
    expect(target).toEqual([1, 2, 3]);
  });
  it('keeps camera at `distance` from focus', () => {
    const { position } = orbitCameraPosition([0, 0, 0], 1.2, 0.5, 7);
    expect(Math.hypot(position[0], position[1], position[2])).toBeCloseTo(7, 5);
  });
  it('positive pitch raises the camera above the focus (look down)', () => {
    const { position } = orbitCameraPosition([0, 0, 0], 0, 0.6, 10);
    expect(position[1]).toBeGreaterThan(0);
  });
});
