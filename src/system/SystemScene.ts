import * as THREE from 'three';
import type { StellarSystem, PlanetType } from './types';
import { orbitPosition, planetPhase, animatedPhase } from './orbit';
import { makePlanetMaterial } from '../planets/PlanetMaterial';
import {
  galacticPathPoint, galacticMarkerParam, GAL_ARC_SPAN, GAL_MARKER_COUNT, GAL_FLOW_SPEED,
} from './galacticPath';

export function planetTypeColor(type: PlanetType): number {
  switch (type) {
    case 'rock': return 0xb08060;
    case 'ocean': return 0x3a6ea5;
    case 'gas': return 0xd9a066;
    case 'ice': return 0xbfe0e5;
  }
}

// 惑星スフィアの見かけ半径（AU）。実サイズは極小なので誇張する。
function planetDisplayRadius(radiusEarth: number): number {
  return 0.02 + Math.min(radiusEarth, 12) * 0.01;
}

export class SystemScene {
  readonly root = new THREE.Group();
  readonly planetMeshes: THREE.Mesh[] = [];
  readonly galMarkers: THREE.Mesh[] = [];
  private readonly ringMeshes = new Map<number, THREE.Mesh>();
  private readonly travelGroup = new THREE.Group();
  private readonly _scratch = new THREE.Vector3();

  constructor(readonly system: StellarSystem) {
    this.root.add(this.travelGroup);

    const star = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc }),
    );
    this.travelGroup.add(star);

    system.planets.forEach((p, i) => {
      const [x, y, z] = orbitPosition(p.semiMajorAxisAu, planetPhase(system.starIndex, i));
      const starDir = new THREE.Vector3(-x, -y, -z).normalize();
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(planetDisplayRadius(p.radiusEarth), 24, 16),
        makePlanetMaterial(p.type, system.starIndex + i, starDir),
      );
      mesh.position.set(x, y, z);
      mesh.userData.planetIndex = i;
      this.planetMeshes.push(mesh);
      this.travelGroup.add(mesh);

      const ringWidth = Math.max(0.01, p.semiMajorAxisAu * 0.01);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(p.semiMajorAxisAu - ringWidth, p.semiMajorAxisAu + ringWidth, 128),
        new THREE.MeshBasicMaterial({
          color: planetTypeColor(p.type), side: THREE.DoubleSide, transparent: true, opacity: 0.85,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.travelGroup.add(ring);

      if (p.hasRing) {
        const r = planetDisplayRadius(p.radiusEarth);
        const planetRing = new THREE.Mesh(
          new THREE.RingGeometry(r * 1.3, r * 2.2, 48),
          new THREE.MeshBasicMaterial({ color: 0xc9b98a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
        );
        planetRing.rotation.x = -Math.PI / 2;
        planetRing.position.set(x, y, z);
        this.ringMeshes.set(i, planetRing);
        this.travelGroup.add(planetRing);
      }
    });

    if (system.starIndex === 0) {
      // 太陽の銀河公転の道すじ（模式的）。太陽=原点がこの線の上に乗る。半径/傾き/範囲は見栄え調整可。
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = -Math.PI / 3 + (i / 96) * GAL_ARC_SPAN;
        pts.push(new THREE.Vector3(...galacticPathPoint(a)));
      }
      const orbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.7 }),
      );
      this.root.add(orbitLine);

      // 道標マーカー: 金の弧に沿って流れて太陽の移動を示す。弧と同じ傾きのグループ配下。
      const markerGroup = new THREE.Group();
      for (let k = 0; k < GAL_MARKER_COUNT; k++) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.85 }),
        );
        const [x, y, z] = galacticPathPoint(galacticMarkerParam(k, GAL_MARKER_COUNT, 0, GAL_FLOW_SPEED));
        m.position.set(x, y, z);
        this.galMarkers.push(m);
        markerGroup.add(m);
      }
      this.root.add(markerGroup);
    }

    this.travelGroup.add(new THREE.PointLight(0xffffff, 2, 0, 0));
  }

  update(t: number): void {
    this.system.planets.forEach((p, i) => {
      const [x, y, z] = orbitPosition(
        p.semiMajorAxisAu,
        animatedPhase(this.system.starIndex, i, p.semiMajorAxisAu, t),
      );
      this.planetMeshes[i]!.position.set(x, y, z);
      this.ringMeshes.get(i)?.position.set(x, y, z);
    });
  }

  planetWorldPos(i: number): [number, number, number] {
    this.root.updateWorldMatrix(true, true);
    this.planetMeshes[i]!.getWorldPosition(this._scratch);
    return [this._scratch.x, this._scratch.y, this._scratch.z];
  }

  sunWorldPos(): [number, number, number] {
    this.root.updateWorldMatrix(true, true);
    this.travelGroup.getWorldPosition(this._scratch);
    return [this._scratch.x, this._scratch.y, this._scratch.z];
  }

  /** 系全体を金の道（+X 方向）に沿って xAu だけ移動。app 側が viewDistance 比例で毎フレーム設定。 */
  setTravelOffset(xAu: number): void {
    this.travelGroup.position.set(xAu, 0, 0);
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
