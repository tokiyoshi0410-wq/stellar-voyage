import * as THREE from 'three';
import type { PlanetType } from '../system/types';
import vert from './planet.vert.glsl?raw';
import frag from './planet.frag.glsl?raw';

const TYPE_INDEX: Record<PlanetType, number> = { rock: 0, ocean: 1, gas: 2, ice: 3 };

export function makePlanetMaterial(
  type: PlanetType, seed: number, starDir: THREE.Vector3,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uType: { value: TYPE_INDEX[type] },
      uSeed: { value: seed },
      uStarDir: { value: starDir.clone() },
    },
    vertexShader: vert,
    fragmentShader: frag,
  });
}
