import { describe, it, expect } from 'vitest';
import {
  temperatureToSpectralClass, parsecsToLightYears, absMagToLuminosity, PARSEC_IN_LY,
} from '../../src/astro/spectral';

describe('spectral', () => {
  it('classifies by temperature', () => {
    expect(temperatureToSpectralClass(40000)).toBe('O');
    expect(temperatureToSpectralClass(5800)).toBe('G');
    expect(temperatureToSpectralClass(3000)).toBe('M');
  });

  it('converts parsecs to light years', () => {
    expect(parsecsToLightYears(1)).toBeCloseTo(PARSEC_IN_LY, 6);
    expect(parsecsToLightYears(10)).toBeCloseTo(32.615637, 4);
  });

  it('sun (absmag 4.83) has luminosity ~1', () => {
    expect(absMagToLuminosity(4.83)).toBeCloseTo(1, 3);
  });

  it('brighter absolute magnitude means higher luminosity', () => {
    expect(absMagToLuminosity(0)).toBeGreaterThan(absMagToLuminosity(5));
  });
});
