import { mulberry32 } from '../system/rng';
import type { GalaxyParams } from './galaxyParams';

export function buildGalaxyGeometry(p: GalaxyParams, seed: number): {
  positions: Float32Array; colors: Float32Array; sizes: Float32Array;
} {
  const n = p.count;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const rng = mulberry32(seed);
  const bulgeCount = Math.floor(n * p.bulgeFraction);
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const clampAbs = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number, r: number, g: number, b: number, s: number;
    if (i < bulgeCount) {
      // 中心バルジ: 半径 radiusAu*0.15 の（やや扁平な）球状分布
      const br = p.radiusAu * 0.15 * Math.cbrt(rng());
      const u = rng() * 2 - 1;
      const phi = rng() * Math.PI * 2;
      const sr = Math.sqrt(1 - u * u);
      x = br * sr * Math.cos(phi);
      y = br * u * 0.6;
      z = br * sr * Math.sin(phi);
      r = p.coreColor[0]; g = p.coreColor[1]; b = p.coreColor[2];
      s = 2.2;
    } else {
      // 円盤: 対数螺旋の腕 + 角度ジッター、XZ が円盤面
      const radius = p.radiusAu * Math.sqrt(rng());
      const arm = i % p.armCount;
      const armAngle = (arm * Math.PI * 2) / p.armCount;
      const spiral = armAngle + p.windings * Math.PI * 2 * (radius / p.radiusAu);
      const angle = spiral + (rng() - 0.5) * 0.5;
      x = radius * Math.cos(angle);
      z = radius * Math.sin(angle);
      const t = radius / p.radiusAu;
      y = (rng() - 0.5) * p.thicknessAu * (1 - 0.7 * t);
      const cj = (rng() - 0.5) * 0.05;
      r = p.coreColor[0] + (p.armColor[0] - p.coreColor[0]) * t + cj;
      g = p.coreColor[1] + (p.armColor[1] - p.coreColor[1]) * t + cj;
      b = p.coreColor[2] + (p.armColor[2] - p.coreColor[2]) * t + cj;
      s = 1.6 + (0.7 - 1.6) * t;
    }
    // 円盤面 (Y) はバルジ・円盤いずれの分布でも thicknessAu 以内に収める（構造的不変条件）
    y = clampAbs(y, p.thicknessAu);
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    colors[i * 3] = clamp01(r); colors[i * 3 + 1] = clamp01(g); colors[i * 3 + 2] = clamp01(b);
    sizes[i] = s;
  }
  return { positions, colors, sizes };
}
