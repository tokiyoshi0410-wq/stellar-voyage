import { describe, it, expect } from 'vitest';
import { pickPlanet } from '../../src/system/planetPick';
import type { StellarSystem } from '../../src/system/types';

// 惑星の実座標は orbitPosition(a, planetPhase(starIndex,i)) で決まる。
// starIndex=0 の位相に依存するため、テストは「正面にある惑星が選ばれる」ことを、
// カメラを惑星実座標の少し手前に置いて確認する。
import { orbitPosition, planetPhase } from '../../src/system/orbit';

const system: StellarSystem = {
  starIndex: 0, starName: 'T', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
  planets: [
    { name: '1番惑星', type: 'rock', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1, eqTempK: null, inHabitableZone: true, isReal: false, estimated: false },
    { name: '2番惑星', type: 'gas', semiMajorAxisAu: 5, radiusEarth: 11, massEarth: 300, eqTempK: null, inHabitableZone: false, isReal: false, estimated: false },
  ],
};

describe('pickPlanet', () => {
  it('selects the planet the ray points at', () => {
    const p1 = orbitPosition(5, planetPhase(0, 1)); // planet index 1
    const cam: [number,number,number] = [p1[0] - 0.5 * (p1[0]/5), p1[1], p1[2] - 0.5 * (p1[2]/5)];
    // ray from cam toward p1
    const dir: [number,number,number] = [p1[0]-cam[0], p1[1]-cam[1], p1[2]-cam[2]];
    expect(pickPlanet(cam, dir, system, 0.1)).toBe(1);
  });
  it('returns null when pointing away from all planets', () => {
    expect(pickPlanet([0,0,0], [0,1,0], system, 0.01)).toBeNull();
  });
});
