import * as THREE from 'three';
import type { StarColumns } from '../catalog/format';
import { bvToRGB } from '../astro/color';
import vert from './starfield.vert.glsl?raw';
import frag from './starfield.frag.glsl?raw';

export function buildStarGeometry(columns: StarColumns): {
  positions: Float32Array; colors: Float32Array; sizes: Float32Array;
} {
  const n = columns.count;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = columns.x[i]!;
    positions[i * 3 + 1] = columns.y[i]!;
    positions[i * 3 + 2] = columns.z[i]!;
    const [r, g, b] = bvToRGB(columns.ci[i]!);
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    sizes[i] = Math.max(0.5, Math.min(12.0, 6.0 - columns.mag[i]!));
  }
  return { positions, colors, sizes };
}

export const AU_PER_PC = 206264.8;

export class StarField {
  readonly object: THREE.Points;
  private readonly material: THREE.ShaderMaterial;
  private focusIndex = -1;
  private savedSize = 0;

  constructor(columns: StarColumns) {
    const { positions, colors, sizes } = buildStarGeometry(columns);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uFocusPc: { value: new THREE.Vector3() },
        uScaleAuPerPc: { value: AU_PER_PC },
        uPixelScale: { value: 300.0 },
      },
      vertexShader: vert,
      fragmentShader: frag,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.object = new THREE.Points(geometry, this.material);
    this.object.frustumCulled = false;
  }

  setFocus(focusPc: [number, number, number], focusIndex: number): void {
    (this.material.uniforms.uFocusPc!.value as THREE.Vector3).set(focusPc[0], focusPc[1], focusPc[2]);
    const attr = this.object.geometry.getAttribute('size') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    if (this.focusIndex >= 0) arr[this.focusIndex] = this.savedSize; // restore previous
    if (focusIndex >= 0) { this.savedSize = arr[focusIndex]!; arr[focusIndex] = 0; }
    this.focusIndex = focusIndex;
    attr.needsUpdate = true;
  }
}
