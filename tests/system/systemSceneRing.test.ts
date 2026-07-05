import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SystemScene } from '../../src/system/SystemScene';
import type { StellarSystem } from '../../src/system/types';

function sys(hasRing: boolean): StellarSystem {
  return {
    starIndex: 0, starName: 'T', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
    planets: [{ name: 'p', type: 'gas', semiMajorAxisAu: 9, radiusEarth: 9, massEarth: 100, eqTempK: null, inHabitableZone: false, isReal: true, estimated: false, hasRing }],
  };
}

describe('SystemScene planet ring', () => {
  it('adds one extra mesh for a ringed planet', () => {
    const withRing = new SystemScene(sys(true));
    const without = new SystemScene(sys(false));
    const meshCount = (s: SystemScene) => s.root.children.filter((o) => o instanceof THREE.Mesh).length;
    expect(meshCount(withRing)).toBe(meshCount(without) + 1);
  });
});
