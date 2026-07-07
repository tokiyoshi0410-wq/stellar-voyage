import * as THREE from 'three';
import vert from './galaxy.vert.glsl?raw';
import frag from './galaxy.frag.glsl?raw';
import { mulberry32 } from '../system/rng';

export interface CosmicWebParams {
  count: number;      // 銀河（点）の総数
  radiusAu: number;   // 大規模構造の広がり半径（模式スケール）
  nodeCount: number;  // 銀河団（node）の数。node 0 は原点＝我々の所属クラスタ
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// 3つの一様乱数の和で近似ガウス（[-1.5,1.5) 中心0）。フィラメント/ブロブの散らばりに使う。
function gaussish(rng: () => number): number {
  return rng() + rng() + rng() - 1.5;
}

/**
 * 宇宙の大規模構造（銀河団 node + フィラメント + ボイド）を決定論生成する。
 * 各点は「銀河」で、galaxy シェーダでふわっとした光点として描く。
 * node 0 を原点に置き、そこに我々の天の川銀河が重なる（＝我々の銀河団）。
 */
export function buildCosmicWeb(seed: number, p: CosmicWebParams): {
  positions: Float32Array; colors: Float32Array; sizes: Float32Array;
} {
  const { count, radiusAu, nodeCount } = p;
  const rng = mulberry32(seed);

  // 銀河団の中心（node）。node 0 = 原点（我々の所属）。残りは球内に散らす。
  const nodes: [number, number, number][] = [[0, 0, 0]];
  for (let k = 1; k < nodeCount; k++) {
    const r = radiusAu * Math.cbrt(rng());
    const u = rng() * 2 - 1;
    const phi = rng() * Math.PI * 2;
    const sr = Math.sqrt(1 - u * u);
    nodes.push([r * sr * Math.cos(phi), r * u * 0.55, r * sr * Math.sin(phi)]);
  }

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const blobSpread = radiusAu * 0.06;   // node 周りの銀河団の広がり
  const filJitter = radiusAu * 0.015;   // フィラメントの太さ

  for (let i = 0; i < count; i++) {
    const nodeIdx = Math.floor(rng() * nodeCount);
    const node = nodes[nodeIdx]!;
    const roll = rng();
    let x: number, y: number, z: number;
    let atNode: boolean;
    if (roll < 0.6) {
      // 銀河団ブロブ: node 周りに集中
      atNode = true;
      x = node[0] + gaussish(rng) * blobSpread;
      y = node[1] + gaussish(rng) * blobSpread * 0.6;
      z = node[2] + gaussish(rng) * blobSpread;
    } else {
      // フィラメント: 近くの別 node へ向かう線上に散らす（網目・ボイドを作る）
      const other = nodes[Math.floor(rng() * nodeCount)]!;
      const t = rng();
      atNode = false;
      x = node[0] + (other[0] - node[0]) * t + gaussish(rng) * filJitter;
      y = node[1] + (other[1] - node[1]) * t + gaussish(rng) * filJitter;
      z = node[2] + (other[2] - node[2]) * t + gaussish(rng) * filJitter;
    }
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;

    // 銀河の色: 青みの渦巻き / 白 / 赤みの楕円 を混ぜる
    const c = rng();
    let r: number, g: number, b: number;
    if (c < 0.4) { r = 0.7; g = 0.8; b = 1.0; }
    else if (c < 0.75) { r = 1.0; g = 0.96; b = 0.88; }
    else { r = 1.0; g = 0.82; b = 0.72; }
    const j = (rng() - 0.5) * 0.12;
    colors[i * 3] = clamp01(r + j);
    colors[i * 3 + 1] = clamp01(g + j);
    colors[i * 3 + 2] = clamp01(b + j);

    // node 上の銀河は少し明るく大きく、フィラメントは小さく
    sizes[i] = atNode ? 1.5 + rng() * 1.3 : 0.9 + rng() * 0.6;
  }

  return { positions, colors, sizes };
}

// 宇宙の大規模構造（銀河団 node ＋ フィラメント）の描画。銀河ディスクと同じ
// 加算合成のふわっとした点シェーダを再利用し、各点を1個の銀河として描く。
export class CosmicWeb {
  readonly object: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(seed: number, p: CosmicWebParams) {
    const { positions, colors, sizes } = buildCosmicWeb(seed, p);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixelScale: { value: 1400.0 }, uOpacity: { value: 0.0 } },
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
