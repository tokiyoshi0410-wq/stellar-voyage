import { describe, it, expect } from 'vitest';
import { describePlanet } from '../../src/ui/PlanetPanel';
import type { Planet } from '../../src/system/types';

const p: Planet = {
  name: '2番惑星', type: 'ocean', semiMajorAxisAu: 1.2, radiusEarth: 1.5, massEarth: 3,
  eqTempK: 280, inHabitableZone: true, isReal: true, estimated: false,
};

describe('describePlanet', () => {
  it('produces Japanese fields including type, orbit, HZ flag, badge', () => {
    const s = describePlanet(p);
    expect(s).toMatch(/海洋/);       // type label in Japanese
    expect(s).toMatch(/1\.2/);       // orbit AU
    expect(s).toMatch(/ハビタブル/); // HZ mention
    expect(s).toMatch(/実在/);       // real badge
  });
});
