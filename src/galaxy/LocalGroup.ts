import * as THREE from 'three';
import { GalaxyDisk } from './GalaxyDisk';
import { MILKY_WAY } from './galaxyParams';

const _scratchA = new THREE.Vector3();

// 太陽の銀河中心からの距離（天の川円盤内、腕の途中）。太陽=原点(=フォーカス点/近傍星野/
// ズーム中心)を天の川の腕の上に一致させるため、天の川円盤中心をこの分だけ逆へずらす
// （中心を原点に置くと「銀河中心=太陽系」と現在地マーカーが二重表示になるバグを防ぐ）。
const SUN_DISK_OFFSET = MILKY_WAY.radiusAu * 0.55;

// 天の川の面内自転速度 rad/秒（実機調整）
const GALAXY_SPIN_SPEED = 0.1;

// 太陽の銀河公転軌道円の基準不透明度（天の川の可視度に比例して掛ける）
const ORBIT_BASE_OPACITY = 0.5;

export class LocalGroup {
  readonly object: THREE.Group;
  private readonly milkyWay: GalaxyDisk;
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
      new THREE.LineBasicMaterial({ color: 0xffd479, transparent: true, opacity: ORBIT_BASE_OPACITY }),
    );
    this.orbitLine.position.set(-SUN_DISK_OFFSET, 0, 0);
    this.orbitLine.rotation.x = 0.5;
    this.object.add(this.orbitLine);
  }

  // galaxy: 天の川円盤の不透明度（フェードインして以降も見え続ける）。
  // detail: 現在地マーカー＋銀河公転円の不透明度（銀河ビューでのみ意味があるので、
  //         宇宙の大規模構造が主役になったら 0 にして消す）。
  setOpacity(galaxy: number, detail: number): void {
    this.milkyWay.setOpacity(galaxy);
    (this.marker.material as THREE.MeshBasicMaterial).opacity = detail;
    // 公転円は基準 0.5 の半透明を保つ（detail で直に上書きすると常に最大不透明になっていた）
    (this.orbitLine.material as THREE.LineBasicMaterial).opacity = ORBIT_BASE_OPACITY * detail;
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

  dispose(): void {
    this.milkyWay.dispose();
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
    this.orbitLine.geometry.dispose();
    (this.orbitLine.material as THREE.Material).dispose();
  }
}
