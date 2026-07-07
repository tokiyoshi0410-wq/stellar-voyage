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
  it('solar system has no galactic-orbit circle line (moved to galaxy view)', () => {
    const scene = new SystemScene(system);
    let hasLine = false;
    scene.root.traverse((o) => { if (o instanceof THREE.Line) hasLine = true; });
    expect(hasLine).toBe(false);
    scene.dispose();
  });
  // 実在系外惑星の 1/4 は a<0.3 AU（最小 55 Cnc e=0.015）。固定 0.3 AU の恒星球だと
  // それらが恒星内部に埋もれて不可視＋クリック横取りになるため、恒星は最内惑星より小さくする。
  it('never lets the central star swallow the innermost planet orbit', () => {
    for (const a of [0.015, 0.15, 0.39, 1]) {
      const sys: StellarSystem = { ...system, planets: [{ ...system.planets[0]!, semiMajorAxisAu: a }] };
      const scene = new SystemScene(sys);
      const star = scene.root.children[0]!.children[0] as THREE.Mesh;
      const r = (star.geometry as THREE.SphereGeometry).parameters.radius;
      expect(r).toBeLessThan(a);
      scene.dispose();
    }
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
  it('re-aims each planet uStarDir toward the (static, origin) star as it orbits', () => {
    const scene = new SystemScene(system);
    scene.update(5); // 公転で惑星位置が初期位相から動く
    for (const mesh of scene.planetMeshes) {
      const dir = (mesh.material as THREE.ShaderMaterial).uniforms.uStarDir!.value as THREE.Vector3;
      // 恒星は原点で静止 → 惑星→恒星方向 = normalize(-position)
      const expected = mesh.position.clone().negate().normalize();
      expect(dir.x).toBeCloseTo(expected.x, 5);
      expect(dir.y).toBeCloseTo(expected.y, 5);
      expect(dir.z).toBeCloseTo(expected.z, 5);
    }
    scene.dispose();
  });
});

