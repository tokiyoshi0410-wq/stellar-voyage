import { describe, it, expect } from 'vitest';
import { pickPlanet } from '../../src/system/planetPick';

describe('pickPlanet (world positions)', () => {
  it('returns the planet whose world position best matches the ray within the cone', () => {
    const positions: [number, number, number][] = [[1, 0, 0], [0, 0, 5]];
    expect(pickPlanet([0, 0, 0], [1, 0, 0], positions, 0.1)).toBe(0);
    expect(pickPlanet([0, 0, 0], [0, 0, 1], positions, 0.1)).toBe(1);
  });
  it('returns null when no planet is within the cone', () => {
    expect(pickPlanet([0, 0, 0], [0, 1, 0], [[1, 0, 0]], 0.1)).toBeNull();
  });
  it('picks the closest-to-ray planet among several', () => {
    const positions: [number, number, number][] = [[10, 0, 0], [0, 10, 0], [0, 0, 10]];
    expect(pickPlanet([0, 0, 0], [0, 1, 0.02], positions, 0.2)).toBe(1);
  });
});
