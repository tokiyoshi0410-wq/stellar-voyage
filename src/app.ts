import * as THREE from 'three';
import { Renderer, isWebGL2Available } from './engine/Renderer';
import { FloatingOrigin } from './engine/FloatingOrigin';
import { StarCatalog } from './catalog/StarCatalog';
import { StarField, AU_PER_PC } from './starfield/StarField';
import { buildStellarSystem } from './system/StellarSystem';
import { SystemScene } from './system/SystemScene';
import { loadExoplanets } from './catalog/exoplanets';
import type { Planet } from './system/types';
import { NavigationController } from './nav/NavigationController';
import { InputMapper } from './nav/InputMapper';
import { orbitCameraPosition } from './nav/orbitCamera';
import { systemFade } from './nav/fade';
import { speedFromSlider } from './nav/speed';
import { SpeedSlider } from './ui/SpeedSlider';
import { ControlHints } from './ui/ControlHints';

const DRAG_SENS = 0.005;
const ZOOM_SENS = 0.0015;
// 画面ピクセル→星クリック判定の許容半径（Task 10 のクリック選択で使用予定）。
const PIXEL_TO_STAR = 300;

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
  // カメラの AU 世界位置（Task 10 のフォーカス切替で使用予定。現時点では未参照）。
  const origin = new FloatingOrigin();
  const nav = new NavigationController();
  const input = new InputMapper(engine.renderer.domElement);
  const slider = new SpeedSlider(root);
  new ControlHints(root);

  engine.renderer.domElement.style.touchAction = 'none';

  window.addEventListener('resize', () => engine.resize(window.innerWidth, window.innerHeight));

  let catalog: StarCatalog;
  try {
    catalog = await StarCatalog.load('/data/hyg.bin', '/data/hyg-names.json');
  } catch {
    showFatal(root, '星カタログの読み込みに失敗しました。`npm run build:catalog` を実行してください。');
    return;
  }

  const exoplanets: Record<number, Planet[]> = await loadExoplanets('/data/exoplanets.json');

  const field = new StarField(catalog.columns);
  engine.scene.add(field.object);

  let systemScene: SystemScene | null = null;
  function rebuildSystem(index: number) {
    if (systemScene) {
      engine.scene.remove(systemScene.root);
      systemScene.dispose();
    }
    const sys = buildStellarSystem(catalog.columns, index, catalog.nameOf(index), exoplanets);
    systemScene = new SystemScene(sys);
    engine.scene.add(systemScene.root);
    return sys;
  }

  // 起動: 太陽（HYG index 0）を斜め上から見下ろす太陽系ビューから開始。
  nav.setFocus(0, [0, 0, 0]);
  let currentSystem = rebuildSystem(0);
  field.setFocus([0, 0, 0], 0); // 太陽は系ビューで表示するため星野側では隠す

  const camAu = new THREE.Vector3();

  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    // --- 入力 → 航法状態 -------------------------------------------------
    const drag = input.consumeDrag();
    nav.orbit(-drag.dx * DRAG_SENS, -drag.dy * DRAG_SENS);
    const w = input.consumeWheel();
    if (w) nav.zoom(Math.exp(w * ZOOM_SENS));
    const mv = input.movement();
    nav.translate(mv.forward, mv.right, speedFromSlider(slider.value()), dt);

    // --- 周回カメラ（原点 = フォーカス点） --------------------------------
    const { position, target } = orbitCameraPosition(
      [0, 0, 0], nav.orbitYaw, nav.orbitPitch, nav.viewDistanceAu,
    );
    engine.camera.position.set(...position);
    engine.camera.lookAt(target[0], target[1], target[2]);
    camAu.set(...position);

    // --- 星野（フォーカス相対描画） ---------------------------------------
    const fp: [number, number, number] = [
      nav.focusWorldAu[0] / AU_PER_PC,
      nav.focusWorldAu[1] / AU_PER_PC,
      nav.focusWorldAu[2] / AU_PER_PC,
    ];
    field.object.position.set(0, 0, 0);
    field.setFocus(fp, nav.focusStarIndex);
    field.updateCamera([camAu.x, camAu.y, camAu.z]);

    // --- フェード（ズームアウトで恒星系→星野へ） ----------------------------
    const fade = systemFade(nav.viewDistanceAu);
    if (systemScene) {
      systemScene.root.traverse((o) => {
        const mat = (o as THREE.Mesh).material;
        if (!mat) return;
        for (const m of Array.isArray(mat) ? mat : [mat]) {
          m.transparent = true;
          m.opacity = fade;
        }
      });
      systemScene.root.visible = fade > 0;
    }

    slider.setReadout(speedFromSlider(slider.value()), currentSystem.starName);

    engine.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
