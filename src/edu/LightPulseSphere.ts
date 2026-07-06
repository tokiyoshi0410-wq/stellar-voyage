import * as THREE from 'three';

// 光の波紋（中心星＝原点から広がる半透明球）。半径(AU)は光速×経過時間で app が駆動する。
// ファイル名は lightPulse.ts（純粋ロジック）と大文字小文字だけ異なる衝突を避けるため Sphere を付す。
export class LightPulseSphere {
  readonly object: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      color: 0xfff2cc, transparent: true, opacity: 0.16,
      side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.object = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), this.material);
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  update(radiusAu: number): void {
    this.object.scale.setScalar(Math.max(radiusAu, 1e-6));
  }
  setVisible(v: boolean): void { this.object.visible = v; }
  dispose(): void { this.object.geometry.dispose(); this.material.dispose(); }
}
