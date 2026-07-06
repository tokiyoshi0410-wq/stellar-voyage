import * as THREE from 'three';
import { GalaxyDisk } from './GalaxyDisk';
import { MILKY_WAY, ANDROMEDA, ANDROMEDA_OFFSET_AU } from './galaxyParams';

const _scratchA = new THREE.Vector3();
const _scratchB = new THREE.Vector3();

// 太陽の銀河中心からの距離（天の川円盤内、腕の途中）。太陽=原点(=フォーカス点/近傍星野/
// ズーム中心)を天の川の腕の上に一致させるため、天の川円盤中心をこの分だけ逆へずらす
// （中心を原点に置くと「銀河中心=太陽系」と現在地マーカーが二重表示になるバグを防ぐ）。
const SUN_DISK_OFFSET = MILKY_WAY.radiusAu * 0.55;

// 天の川の面内自転速度 rad/秒（実機調整）
const GALAXY_SPIN_SPEED = 0.1;

export class LocalGroup {
  readonly object: THREE.Group;
  private readonly milkyWay: GalaxyDisk;
  private readonly andromeda: GalaxyDisk;
  private readonly marker: THREE.Mesh;
  private readonly orbitLine: THREE.Line;

  constructor() {
    this.object = new THREE.Group();

    // 天の川銀河: 太陽(原点)が銀河中心でなく銀河内の途中に来るよう円盤中心を -SUN_DISK_OFFSET へずらす
    this.milkyWay = new GalaxyDisk(MILKY_WAY, 1);
    this.milkyWay.object.position.set(-SUN_DISK_OFFSET, 0, 0);
    // 既定 Euler order 'XYZ' で rotation.y が円盤面内の自転になる（YXZ にすると歳差でぐらつく）
    this.milkyWay.object.rotation.x = 0.5;
    this.object.add(this.milkyWay.object);

    // アンドロメダ銀河（概念距離だけ離し、別角度に傾ける）
    this.andromeda = new GalaxyDisk(ANDROMEDA, 2);
    this.andromeda.object.position.set(ANDROMEDA_OFFSET_AU - SUN_DISK_OFFSET, 0, 0);
    this.andromeda.object.rotation.x = 0.7;
    this.andromeda.object.rotation.z = 0.3;
    this.object.add(this.andromeda.object);

    // 現在地マーカー(太陽): group 原点(=太陽=カメラ注視点=近傍星野=ズーム中心)に直接置く。
    // 円盤(milkyWay)の傾きに依存させず原点一致を構造的に保証する（円盤中心は太陽から
    // SUN_DISK_OFFSET 離れている＝太陽は銀河中心ではなく銀河内の途中にいる）。
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(MILKY_WAY.radiusAu * 0.02, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd479, transparent: true }),
    );
    this.marker.position.set(0, 0, 0);
    this.object.add(this.marker);

    // 太陽の銀河公転軌道（実比率）: 銀河中心を中心・半径 SUN_DISK_OFFSET・天の川面内。太陽=原点はこの円上(a=0)。
    const orbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      orbitPts.push(new THREE.Vector3(SUN_DISK_OFFSET * Math.cos(a), 0, SUN_DISK_OFFSET * Math.sin(a)));
    }
    this.orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPts),
      new THREE.LineBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.5 }),
    );
    this.orbitLine.position.set(-SUN_DISK_OFFSET, 0, 0);
    this.orbitLine.rotation.x = 0.5;
    this.object.add(this.orbitLine);
  }

  setOpacity(o: number): void {
    this.milkyWay.setOpacity(o);
    this.andromeda.setOpacity(o);
    (this.marker.material as THREE.MeshBasicMaterial).opacity = o;
    (this.orbitLine.material as THREE.LineBasicMaterial).opacity = o;
  }

  setPosition(x: number, y: number, z: number): void {
    this.object.position.set(x, y, z);
  }

  markerWorldPos(): [number, number, number] {
    this.object.updateWorldMatrix(true, true);
    this.marker.getWorldPosition(_scratchA);
    return [_scratchA.x, _scratchA.y, _scratchA.z];
  }

  update(t: number): void {
    this.milkyWay.object.rotation.y = GALAXY_SPIN_SPEED * t;
  }

  galacticCenterWorldPos(): [number, number, number] {
    this.object.updateWorldMatrix(true, true);
    this.milkyWay.object.getWorldPosition(_scratchA);
    return [_scratchA.x, _scratchA.y, _scratchA.z];
  }

  midpointWorldPos(): [number, number, number] {
    this.object.updateWorldMatrix(true, true);
    this.milkyWay.object.getWorldPosition(_scratchA);
    this.andromeda.object.getWorldPosition(_scratchB);
    return [
      (_scratchA.x + _scratchB.x) / 2,
      (_scratchA.y + _scratchB.y) / 2,
      (_scratchA.z + _scratchB.z) / 2,
    ];
  }

  dispose(): void {
    this.milkyWay.dispose();
    this.andromeda.dispose();
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
    this.orbitLine.geometry.dispose();
    (this.orbitLine.material as THREE.Material).dispose();
  }
}
