import { describe, it, expect } from 'vitest';
import { bvToTemperature, temperatureToRGB, bvToRGB } from '../../src/astro/color';

describe('color', () => {
  it('sun-like B-V ~0.63 gives ~5700-5900K', () => {
    const t = bvToTemperature(0.63);
    expect(t).toBeGreaterThan(5600);
    expect(t).toBeLessThan(6000);
  });

  it('blue star (negative B-V) is hotter than red star', () => {
    expect(bvToTemperature(-0.3)).toBeGreaterThan(bvToTemperature(1.5));
  });

  it('temperatureToRGB returns channels in 0..1', () => {
    const [r, g, b] = temperatureToRGB(6000);
    for (const c of [r, g, b]) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(1); }
  });

  it('hot star is bluer than cool star', () => {
    const hot = bvToRGB(-0.3);
    const cool = bvToRGB(1.5);
    expect(hot[2]).toBeGreaterThan(cool[2]); // more blue
    expect(cool[0]).toBeGreaterThan(cool[2]); // red dominates cool star
  });
});
