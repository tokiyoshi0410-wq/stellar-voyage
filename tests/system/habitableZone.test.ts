import { describe, it, expect } from 'vitest';
import { habitableZone, inHabitableZone } from '../../src/system/habitableZone';

describe('habitableZone', () => {
  it('sun (L=1) is roughly 0.95..1.37 AU', () => {
    const hz = habitableZone(1);
    expect(hz.inner).toBeCloseTo(0.953, 2);
    expect(hz.outer).toBeCloseTo(1.374, 2);
  });

  it('brighter star has a farther zone', () => {
    expect(habitableZone(4).inner).toBeGreaterThan(habitableZone(1).inner);
  });

  it('inHabitableZone flags orbits inside the band', () => {
    expect(inHabitableZone(1.0, 1)).toBe(true);
    expect(inHabitableZone(0.2, 1)).toBe(false);
    expect(inHabitableZone(5.0, 1)).toBe(false);
  });
});
