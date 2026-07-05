import { describe, it, expect } from 'vitest';
import { describePlanet } from '../../src/ui/PlanetPanel';
import type { Planet } from '../../src/system/types';
import { PLANET_FACTS, earthClosestApproachAu } from '../../src/system/solarFacts';

const mars: Planet = {
  name: '火星', type: 'rock', semiMajorAxisAu: 1.52, radiusEarth: 0.53, massEarth: 0.107,
  eqTempK: null, inHabitableZone: false, isReal: true, estimated: false,
};

describe('describePlanet', () => {
  it('omits facts lines when facts not given (procedural)', () => {
    const s = describePlanet(mars);
    expect(s).not.toMatch(/公転/);
    expect(s).toMatch(/種別/);
  });
  it('adds orbital/rotation/distance/travel lines with facts', () => {
    const s = describePlanet(mars, PLANET_FACTS[3], earthClosestApproachAu(1.52));
    expect(s).toMatch(/公転: 86,760 km\/h/);
    expect(s).toMatch(/自転: 赤道 866 km\/h/);
    expect(s).toMatch(/地球から最接近/);
    expect(s).toMatch(/新幹線/);
  });
  it('marks retrograde planets', () => {
    const venus: Planet = { ...mars, name: '金星', semiMajorAxisAu: 0.72 };
    const s = describePlanet(venus, PLANET_FACTS[1], earthClosestApproachAu(0.72));
    expect(s).toMatch(/自転: 赤道 6.5 km\/h\(逆回転\)/);
  });
  it('shows 母星 for Earth (closestAu 0), not distance/travel', () => {
    const earth: Planet = { ...mars, name: '地球', type: 'ocean', semiMajorAxisAu: 1.0 };
    const s = describePlanet(earth, PLANET_FACTS[2], 0);
    expect(s).toMatch(/母星/);
    expect(s).not.toMatch(/最接近/);
  });
});
