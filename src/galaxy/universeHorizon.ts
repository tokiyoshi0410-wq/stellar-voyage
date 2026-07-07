import * as THREE from 'three';
import vert from './galaxy.vert.glsl?raw';
import frag from './galaxy.frag.glsl?raw';
import { mulberry32 } from '../system/rng';

export interface HorizonParams {
  count: number;      // 球殻の点の数
  radiusAu: number;   // 観測可能な宇宙の地平線半径（模式スケール）
  thicknessAu: number; // 球殻の厚み
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * 観測可能な宇宙の「地平線」＝最遠の光（宇宙マイクロ波背景 CMB）を模した球殻を決定論生成する。
 * 全方位に薄くまだらな光点を球面上に散らす。ズームアウトの終着点として、大規模構造を包む。
 */
export function buildHorizonShell(seed: number, p: HorizonParams): {
  positions: Float32Array; colors: Float32Array; sizes: Float32Array;
} {
  const { count, radiusAu, thicknessAu } = p;
  const rng = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // 球面上の一様分布（u=cosθ 一様）＋厚みジッター
    const u = rng() * 2 - 1;
    const phi = rng() * Math.PI * 2;
    const sr = Math.sqrt(1 - u * u);
    const r = radiusAu + (rng() - 0.5) * thicknessAu;
    positions[i * 3] = r * sr * Math.cos(phi);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * sr * Math.sin(phi);
    // CMB 風のまだら: 温かい基調に微小な赤/青のゆらぎ（温度ゆらぎのイメージ）
    const t = (rng() - 0.5) * 0.25;
    colors[i * 3] = clamp01(0.95 + t);
    colors[i * 3 + 1] = clamp01(0.86);
    colors[i * 3 + 2] = clamp01(0.78 - t);
    sizes[i] = 1.0 + rng() * 0.8;
  }
  return { positions, colors, sizes };
}

// 観測可能な宇宙の地平線シェル描画。銀河と同じ加算のふわっとした点シェーダを再利用。
export class UniverseHorizon {
  readonly object: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(seed: number, p: HorizonParams) {
    const { positions, colors, sizes } = buildHorizonShell(seed, p);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixelScale: { value: 1500.0 }, uOpacity: { value: 0.0 } },
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

  setOpacity(o: number): void {
    this.material.uniforms.uOpacity!.value = o;
  }

  setPosition(x: number, y: number, z: number): void {
    this.object.position.set(x, y, z);
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.material.dispose();
  }
}
