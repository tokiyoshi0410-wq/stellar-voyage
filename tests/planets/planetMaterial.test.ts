import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makePlanetMaterial } from '../../src/planets/PlanetMaterial';

describe('makePlanetMaterial', () => {
  it('returns a ShaderMaterial with type/seed/starDir uniforms', () => {
    const m = makePlanetMaterial('gas', 3, new THREE.Vector3(1, 0, 0));
    expect(m).toBeInstanceOf(THREE.ShaderMaterial);
    expect(m.uniforms.uType!.value).toBe(2); // gas -> 2
    expect(m.uniforms.uSeed!.value).toBe(3);
    expect((m.uniforms.uStarDir!.value as THREE.Vector3).x).toBe(1);
  });
  it('maps each type to a distinct uType index', () => {
    const idx = (['rock','ocean','gas','ice'] as const).map(
      (t) => makePlanetMaterial(t, 0, new THREE.Vector3()).uniforms.uType!.value,
    );
    expect(new Set(idx).size).toBe(4);
  });
});
