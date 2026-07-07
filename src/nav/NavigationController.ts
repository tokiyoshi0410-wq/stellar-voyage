export const MIN_VIEW_AU = 0.05;
// 銀河団→超銀河団（宇宙の大規模構造）まで引けるよう上限を拡張。
export const MAX_VIEW_AU = 1e12;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class NavigationController {
  focusStarIndex = 0;
  focusWorldAu: [number, number, number] = [0, 0, 0];
  orbitYaw = 0;
  orbitPitch = 0.6;
  viewDistanceAu = 40;

  orbit(dYaw: number, dPitch: number): void {
    this.orbitYaw += dYaw;
    this.orbitPitch = clamp(this.orbitPitch + dPitch, -1.5, 1.5);
  }

  zoom(factor: number): void {
    this.viewDistanceAu = clamp(this.viewDistanceAu * factor, MIN_VIEW_AU, MAX_VIEW_AU);
  }

  translate(forward: number, right: number, speedAuPerSec: number, dt: number): void {
    const y = this.orbitYaw;
    const fwd: [number, number, number] = [-Math.sin(y), 0, -Math.cos(y)];
    const rgt: [number, number, number] = [Math.cos(y), 0, -Math.sin(y)];
    const d = speedAuPerSec * dt;
    this.focusWorldAu[0] += (fwd[0] * forward + rgt[0] * right) * d;
    this.focusWorldAu[1] += (fwd[1] * forward + rgt[1] * right) * d;
    this.focusWorldAu[2] += (fwd[2] * forward + rgt[2] * right) * d;
  }

  setFocus(index: number, worldAu: [number, number, number]): void {
    this.focusStarIndex = index;
    this.focusWorldAu = [worldAu[0], worldAu[1], worldAu[2]];
  }
}
