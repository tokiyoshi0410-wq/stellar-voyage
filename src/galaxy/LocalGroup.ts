import * as THREE from 'three';
import { GalaxyDisk } from './GalaxyDisk';
import { MILKY_WAY, ANDROMEDA, ANDROMEDA_OFFSET_AU } from './galaxyParams';

export class LocalGroup {
  readonly object: THREE.Group;
  private readonly milkyWay: GalaxyDisk;
  private readonly andromeda: GalaxyDisk;
  private readonly marker: THREE.Mesh;

  constructor() {
    this.object = new THREE.Group();

    // 天の川銀河（原点、見栄えのため傾ける）
    this.milkyWay = new GalaxyDisk(MILKY_WAY, 1);
    this.milkyWay.object.rotation.x = 0.5;
    this.object.add(this.milkyWay.object);

    // アンドロメダ銀河（概念距離だけ離し、別角度に傾ける）
    this.andromeda = new GalaxyDisk(ANDROMEDA, 2);
    this.andromeda.object.position.set(ANDROMEDA_OFFSET_AU, 0, 0);
    this.andromeda.object.rotation.x = 0.7;
    this.andromeda.object.rotation.z = 0.3;
    this.object.add(this.andromeda.object);

    // 現在地マーカー（天の川円盤内の一点。傾きを継承させるため milkyWay の子）
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(MILKY_WAY.radiusAu * 0.02, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd479 }),
    );
    this.marker.position.set(MILKY_WAY.radiusAu * 0.55, 0, 0);
    this.milkyWay.object.add(this.marker);
  }

  setOpacity(o: number): void {
    this.milkyWay.setOpacity(o);
    this.andromeda.setOpacity(o);
  }

  setPosition(x: number, y: number, z: number): void {
    this.object.position.set(x, y, z);
  }

  markerWorldPos(): [number, number, number] {
    this.object.updateWorldMatrix(true, true);
    const v = new THREE.Vector3();
    this.marker.getWorldPosition(v);
    return [v.x, v.y, v.z];
  }

  midpointWorldPos(): [number, number, number] {
    this.object.updateWorldMatrix(true, true);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    this.milkyWay.object.getWorldPosition(a);
    this.andromeda.object.getWorldPosition(b);
    return [(a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2];
  }

  dispose(): void {
    this.milkyWay.dispose();
    this.andromeda.dispose();
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
  }
}
