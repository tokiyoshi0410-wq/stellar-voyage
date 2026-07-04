import * as THREE from 'three';
import { Renderer, isWebGL2Available } from './engine/Renderer';
import { FloatingOrigin } from './engine/FloatingOrigin';
import { StarCatalog } from './catalog/StarCatalog';
import { StarField } from './starfield/StarField';
import { ShipController } from './flight/ShipController';
import { InputController } from './flight/InputController';
import { pickStar } from './selection/Picker';
import { HUD } from './ui/HUD';
import { InfoPanel } from './ui/InfoPanel';
import { SystemHud } from './ui/SystemHud';
import { describeStar } from './ui/format';
import { buildStellarSystem } from './system/StellarSystem';
import { SystemScene } from './system/SystemScene';

const LOOK_SENSITIVITY = 0.0025;
const PICK_ANGLE = 0.01; // rad

type AppMode = 'galaxy' | 'system';

export function showFatal(root: HTMLElement, message: string): void {
  const div = document.createElement('div');
  div.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'color:#eaf2ff;font:16px/1.7 system-ui,sans-serif;text-align:center;padding:24px;';
  div.textContent = message;
  root.appendChild(div);
}

export async function startApp(root: HTMLElement): Promise<void> {
  const probe = document.createElement('canvas');
  if (!isWebGL2Available(probe)) {
    showFatal(root, 'このブラウザは WebGL2 に対応していません。最新の Chrome / Edge / Firefox / Safari でお試しください。');
    return;
  }

  const engine = new Renderer(root);
  const origin = new FloatingOrigin();
  const ship = new ShipController(origin);
  const input = new InputController(engine.renderer.domElement);
  const hud = new HUD(root);
  const panel = new InfoPanel(root);
  const systemHud = new SystemHud(root);

  engine.renderer.domElement.tabIndex = 0;
  engine.renderer.domElement.style.outline = 'none';
  engine.renderer.domElement.addEventListener('click', () => {
    engine.renderer.domElement.requestPointerLock?.();
  });

  let catalog: StarCatalog;
  let field: StarField;
  try {
    catalog = await StarCatalog.load('/data/hyg.bin', '/data/hyg-names.json');
  } catch {
    showFatal(root, '星カタログの読み込みに失敗しました。`npm run build:catalog` を実行してください。');
    return;
  }
  field = new StarField(catalog.columns);
  engine.scene.add(field.object);

  window.addEventListener('resize', () => engine.resize(window.innerWidth, window.innerHeight));

  // --- mode 状態 -------------------------------------------------------
  let mode: AppMode = 'galaxy';
  let systemScene: SystemScene | null = null;
  let savedPos: [number, number, number] | null = null;
  let savedQuat: THREE.Quaternion | null = null;
  const yawPitch = { yaw: 0, pitch: 0 };

  function enterSystem(index: number): void {
    // galaxy のカメラ位置・向きを退避
    savedPos = [origin.position[0], origin.position[1], origin.position[2]];
    savedQuat = ship.orientation.clone();

    const system = buildStellarSystem(catalog.columns, index, catalog.nameOf(index));
    systemScene = new SystemScene(system);
    engine.scene.remove(field.object);
    engine.scene.add(systemScene.root);

    // system ビューは AU 単位・実座標。恒星の少し手前に配置し、原点向きにリセット。
    origin.setPosition(0, 0, 8);
    ship.orientation.identity();
    yawPitch.yaw = 0;
    yawPitch.pitch = 0;
    engine.camera.position.set(0, 0, 8);

    systemHud.show(system.starName, exitSystem);
    panel.hide();
    mode = 'system';
  }

  function exitSystem(): void {
    if (systemScene) {
      engine.scene.remove(systemScene.root);
      systemScene.dispose();
      systemScene = null;
    }
    engine.scene.add(field.object);

    if (savedPos) {
      origin.setPosition(savedPos[0], savedPos[1], savedPos[2]);
    }
    if (savedQuat) {
      ship.orientation.copy(savedQuat);
      const euler = new THREE.Euler().setFromQuaternion(savedQuat, 'YXZ');
      yawPitch.yaw = euler.y;
      yawPitch.pitch = euler.x;
    }
    savedPos = null;
    savedQuat = null;
    // galaxy は floating origin（カメラはワールド原点固定）に戻す
    engine.camera.position.set(0, 0, 0);

    systemHud.hide();
    mode = 'galaxy';
  }

  // クリックで最近傍の星を選択（galaxy のみ。system の惑星選択は Task 7）
  engine.renderer.domElement.addEventListener('pointerdown', () => {
    if (mode !== 'galaxy') return;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.orientation);
    const idx = pickStar(
      [origin.position[0], origin.position[1], origin.position[2]],
      [dir.x, dir.y, dir.z], catalog.columns, PICK_ANGLE,
    );
    if (idx != null) {
      panel.show(describeStar(catalog.columns, idx, catalog.nameOf(idx)), () => enterSystem(idx));
    }
  });

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    const { dx, dy } = input.consumePointerDelta();
    yawPitch.yaw -= dx * LOOK_SENSITIVITY;
    yawPitch.pitch -= dy * LOOK_SENSITIVITY;
    yawPitch.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, yawPitch.pitch));
    const euler = new THREE.Euler(yawPitch.pitch, yawPitch.yaw, 0, 'YXZ');
    ship.orientation.setFromEuler(euler);

    ship.throttle = input.applyThrottle(ship.throttle, dt);
    ship.update(dt);

    engine.camera.quaternion.copy(ship.orientation);

    if (mode === 'galaxy') {
      field.updateOrigin(origin);
      hud.update(ship.speedC, ship.isWarp, null);
    } else {
      // system ビューは近距離 AU スケールなのでカメラをワールド座標に直接置く
      engine.camera.position.set(origin.position[0], origin.position[1], origin.position[2]);
    }

    engine.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
