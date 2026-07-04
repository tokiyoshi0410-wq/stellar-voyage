import * as THREE from 'three';
import type { FloatingOrigin } from '../engine/FloatingOrigin';

export const C_PC_PER_S = 9.7156e-9;   // 光速 [pc/s]（実時間）
export const TIME_COMPRESSION = 3.156e7; // 実 1 秒 ≒ 1 年ぶんの移動
export const NORMAL_BAND = 0.7;         // 通常航行に割り当てる throttle 割合
export const MAX_WARP_C = 3.156e10;     // ワープ上限 ≈ 3.16e10 ×c ≈ 3.16e10 ly/s（毎秒約316億光年）。M3 で体感カーブ再調整の余地あり

export class ShipController {
  throttle = 0;
  readonly orientation = new THREE.Quaternion();
  private readonly forward = new THREE.Vector3();

  constructor(private readonly origin: FloatingOrigin) {}

  throttleToSpeedC(throttle: number): number {
    const t = Math.max(0, Math.min(1, throttle));
    if (t <= NORMAL_BAND) return (t / NORMAL_BAND) * 0.999;
    const w = (t - NORMAL_BAND) / (1 - NORMAL_BAND);
    return Math.pow(MAX_WARP_C, w);
  }

  get speedC(): number {
    return this.throttleToSpeedC(this.throttle);
  }

  get isWarp(): boolean {
    return this.throttle > NORMAL_BAND;
  }

  update(dtSeconds: number): void {
    const speedC = this.speedC;
    if (speedC <= 0) return;
    const pc = speedC * C_PC_PER_S * TIME_COMPRESSION * dtSeconds;
    this.forward.set(0, 0, -1).applyQuaternion(this.orientation);
    this.origin.translate(this.forward.x * pc, this.forward.y * pc, this.forward.z * pc);
  }
}
