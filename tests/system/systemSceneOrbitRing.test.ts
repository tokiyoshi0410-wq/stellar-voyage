import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SystemScene, planetTypeColor } from '../../src/system/SystemScene';
import type { StellarSystem } from '../../src/system/types';

function sysOneOceanPlanet(): StellarSystem {
  return {
    starIndex: 0, starName: 'T', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
    planets: [{ name: 'p', type: 'ocean', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1, eqTempK: null, inHabitableZone: true, isReal: true, estimated: false }],
  };
}

describe('SystemScene orbit ring visibility', () => {
  it('draws the orbit ring in the planet type color at high opacity', () => {
    const scene = new SystemScene(sysOneOceanPlanet());
    // 軌道リングは travelGroup（root.children[0]）配下
    const ring = scene.root.children[0]!.children.find(
      (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.geometry instanceof THREE.RingGeometry,
    )!;
    const mat = ring.material as THREE.MeshBasicMaterial;
    expect(mat.color.getHex()).toBe(planetTypeColor('ocean'));
    expect(mat.opacity).toBeCloseTo(0.85, 5);
  });
});
