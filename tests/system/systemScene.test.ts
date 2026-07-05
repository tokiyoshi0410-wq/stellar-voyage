import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SystemScene, planetTypeColor } from '../../src/system/SystemScene';
import type { StellarSystem } from '../../src/system/types';

const system: StellarSystem = {
  starIndex: 0, starName: 'Test', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
  planets: [
    { name: '1番惑星', type: 'rock', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1, eqTempK: null, inHabitableZone: true, isReal: false, estimated: false },
    { name: '2番惑星', type: 'gas', semiMajorAxisAu: 5, radiusEarth: 11, massEarth: 300, eqTempK: null, inHabitableZone: false, isReal: false, estimated: false },
  ],
};

describe('planetTypeColor', () => {
  it('gives a distinct color per type', () => {
    const colors = new Set(['rock','ocean','gas','ice'].map((t) => planetTypeColor(t as any)));
    expect(colors.size).toBe(4);
  });
});

describe('SystemScene', () => {
  it('builds star + light + one sphere and one ring per planet', () => {
    const scene = new SystemScene(system);
    expect(scene.planetMeshes.length).toBe(2);
    const meshes = scene.root.children.filter((o) => o instanceof THREE.Mesh);
    // 恒星(1) + 惑星(2) + リング(2) = 5 メッシュ
    expect(meshes.length).toBe(5);
    expect(scene.root.children.some((o) => o instanceof THREE.PointLight)).toBe(true);
  });
  it('tags planet meshes with their index', () => {
    const scene = new SystemScene(system);
    expect(scene.planetMeshes[0]!.userData.planetIndex).toBe(0);
    expect(scene.planetMeshes[1]!.userData.planetIndex).toBe(1);
  });
  it('places planet 0 at radius ~1 AU from origin', () => {
    const scene = new SystemScene(system);
    expect(scene.planetMeshes[0]!.position.length()).toBeCloseTo(1, 5);
  });
});

function makeSystem(starIndex: number): StellarSystem {
  return { starIndex, starName: 't', spectralClass: 'G', temperatureK: 5800, luminositySun: 1, planets: [] };
}

describe('SystemScene solar arrow', () => {
  it('adds the Sun galactic-orbit line for the Solar System (starIndex 0)', () => {
    const scene = new SystemScene(makeSystem(0));
    expect(scene.root.children.some((c) => c instanceof THREE.Line)).toBe(true);
    scene.dispose();
  });
  it('does not add the orbit line for procedural systems', () => {
    const scene = new SystemScene(makeSystem(5));
    expect(scene.root.children.some((c) => c instanceof THREE.Line)).toBe(false);
    scene.dispose();
  });
});
