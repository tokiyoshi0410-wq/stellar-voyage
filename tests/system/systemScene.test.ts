import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SystemScene, planetTypeColor } from '../../src/system/SystemScene';
import type { StellarSystem } from '../../src/system/types';
import { GAL_MARKER_COUNT } from '../../src/system/galacticPath';

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
    // 恒星・惑星・軌道リング・PointLight は travelGroup（root.children[0]）配下
    const travelGroup = scene.root.children[0]!;
    const meshes = travelGroup.children.filter((o) => o instanceof THREE.Mesh);
    // 恒星(1) + 惑星(2) + リング(2) = 5 メッシュ
    expect(meshes.length).toBe(5);
    expect(travelGroup.children.some((o) => o instanceof THREE.PointLight)).toBe(true);
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

describe('SystemScene.update', () => {
  it('update(t) advances planet mesh positions', () => {
    const sys: StellarSystem = {
      starIndex: 0, starName: 'x', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
      planets: [{
        name: 'p', type: 'rock', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1,
        eqTempK: null, inHabitableZone: false, isReal: true, estimated: false,
      }],
    };
    const scene = new SystemScene(sys);
    const before = scene.planetMeshes[0]!.position.clone();
    scene.update(5);
    expect(scene.planetMeshes[0]!.position.distanceTo(before)).toBeGreaterThan(0);
    // 中心星のローカル位置は update で動かない（travelGroup 経由でのみ移動する）
    const travelGroup = scene.root.children[0]!;
    expect(travelGroup.children[0]!.position.length()).toBe(0);
    scene.dispose();
  });
});

describe('SystemScene galactic-path markers', () => {
  it('solar system has fixed galactic-path markers (milestones) that do not move with update(t)', () => {
    const sys: StellarSystem = {
      starIndex: 0, starName: '太陽', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
      planets: [],
    };
    const scene = new SystemScene(sys);
    expect(scene.galMarkers.length).toBe(GAL_MARKER_COUNT);
    const before = scene.galMarkers[0]!.position.clone();
    scene.update(3);
    expect(scene.galMarkers[0]!.position.distanceTo(before)).toBe(0);
    scene.dispose();
  });
  it('non-solar system has no galactic-path markers', () => {
    const sys: StellarSystem = {
      starIndex: 5, starName: 'x', spectralClass: 'K', temperatureK: 4000, luminositySun: 0.3,
      planets: [],
    };
    const scene = new SystemScene(sys);
    expect(scene.galMarkers.length).toBe(0);
    scene.dispose();
  });
});

describe('SystemScene travel (whole system travels the galactic path)', () => {
  it('solar: setTravelOffset moves the whole system (sun + planet world pos), markers stay fixed', () => {
    const sys: StellarSystem = {
      starIndex: 0, starName: '太陽', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
      planets: [{
        name: 'p', type: 'rock', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1,
        eqTempK: null, inHabitableZone: false, isReal: true, estimated: false,
      }],
    };
    const scene = new SystemScene(sys);
    const sun0 = scene.sunWorldPos();
    const p0 = scene.planetWorldPos(0);
    const marker0 = scene.galMarkers[0]!.position.clone();
    scene.setTravelAngle(0.3);
    const sun1 = scene.sunWorldPos();
    const p1 = scene.planetWorldPos(0);
    expect(Math.hypot(sun1[0]-sun0[0], sun1[1]-sun0[1], sun1[2]-sun0[2])).toBeGreaterThan(0);
    expect(Math.hypot(p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2])).toBeGreaterThan(0);
    expect(scene.galMarkers[0]!.position.distanceTo(marker0)).toBe(0);
    scene.dispose();
  });
  it('non-solar: sun stays at origin (no travel)', () => {
    const sys: StellarSystem = {
      starIndex: 5, starName: 'x', spectralClass: 'K', temperatureK: 4000, luminositySun: 0.3,
      planets: [],
    };
    const scene = new SystemScene(sys);
    scene.update(3);
    const sun = scene.sunWorldPos();
    expect(Math.hypot(sun[0], sun[1], sun[2])).toBe(0);
    scene.dispose();
  });
});
