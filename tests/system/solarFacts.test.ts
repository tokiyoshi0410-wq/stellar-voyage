import { describe, it, expect } from 'vitest';
import {
  PLANET_FACTS, SUN_FACTS, earthClosestApproachAu,
  formatManKm, formatLightTravel, formatShinkansenTravel, formatOrbitalKmH,
} from '../../src/system/solarFacts';
import { getSolarSystem } from '../../src/system/solarSystem';

describe('solarFacts', () => {
  it('has 8 planets index-aligned with getSolarSystem', () => {
    expect(PLANET_FACTS.length).toBe(8);
  });
  it('PLANET_FACTS length stays aligned with getSolarSystem (index guard)', () => {
    expect(PLANET_FACTS.length).toBe(getSolarSystem().length);
  });
  it('flags Venus(1) and Uranus(6) retrograde, Earth(2) not', () => {
    expect(PLANET_FACTS[1]!.retrograde).toBe(true);
    expect(PLANET_FACTS[6]!.retrograde).toBe(true);
    expect(PLANET_FACTS[2]!.retrograde).toBe(false);
  });
  it('earthClosestApproachAu = |a - 1|', () => {
    expect(earthClosestApproachAu(1.52)).toBeCloseTo(0.52, 5);
    expect(earthClosestApproachAu(1)).toBe(0);
    expect(earthClosestApproachAu(0.72)).toBeCloseTo(0.28, 5);
  });
  it('formatManKm rounds 万km and switches to 億km', () => {
    expect(formatManKm(0.52)).toBe('約7800万km');
    expect(formatManKm(4.2)).toMatch(/億km$/);
  });
  it('formatManKm promotes to 億km at the rounding boundary (no "約10000万km")', () => {
    // 0.668 AU ≈ 9993万km → 100万km丸めで10000万km になるので億へ繰り上げる
    expect(formatManKm(0.668)).toMatch(/億km$/);
    expect(formatManKm(0.668)).not.toMatch(/万km$/);
  });
  it('formatShinkansenTravel gives years for planet distances', () => {
    expect(formatShinkansenTravel(0.52)).toBe('約30年');
    expect(formatShinkansenTravel(29.1)).toMatch(/約1\d{3}年/);
  });
  it('formatLightTravel gives minutes for Mars, hours for Neptune', () => {
    expect(formatLightTravel(0.52)).toMatch(/分/);
    expect(formatLightTravel(29.1)).toMatch(/時間/);
  });
  it('SUN_FACTS carries galactic data', () => {
    expect(SUN_FACTS.galacticSpeedKmS).toBe(220);
    expect(SUN_FACTS.galacticCenterLy).toBe(26000);
  });
  it('formatOrbitalKmH converts km/s to comma-grouped km/h', () => {
    expect(formatOrbitalKmH(29.8)).toBe('107,280 km/h');
    expect(formatOrbitalKmH(47.4)).toBe('170,640 km/h');
  });
});
