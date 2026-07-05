import * as THREE from 'three';
import { Renderer, isWebGL2Available } from './engine/Renderer';
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
import { pickStar } from './selection/Picker';
import { pickPlanet } from './system/planetPick';
import { InfoPanel } from './ui/InfoPanel';
import { PlanetPanel } from './ui/PlanetPanel';
import { describeStar, formatAuDistance, starDisplayName } from './ui/format';
import { nearestStarPc } from './nav/nearestStar';
import { orbitPosition, planetPhase } from './system/orbit';
import { LabelLayer, type LabelItem } from './ui/LabelLayer';
import { nearestStarsPc } from './nav/nearestStars';
import { PARSEC_IN_LY } from './astro/spectral';

const DRAG_SENS = 0.005;
const ZOOM_SENS = 0.0015;
const PICK_ANGLE = 0.02;
const PLANET_PICK_ANGLE = 0.05;
const FOCUS_HYSTERESIS = 0.9; // 新しい最近傍星へ切り替える距離マージン（境界での往復防止）

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
  const nav = new NavigationController();
  const input = new InputMapper(engine.renderer.domElement);
  const slider = new SpeedSlider(root);
  new ControlHints(root);
  const infoPanel = new InfoPanel(root);
  const planetPanel = new PlanetPanel(root);
  const labels = new LabelLayer(root);

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

  // --- クリック選択（ドラッグと区別） ----------------------------------------
  let downPos = { x: 0, y: 0 };
  engine.renderer.domElement.addEventListener('pointerdown', (e: PointerEvent) => {
    downPos = { x: e.clientX, y: e.clientY };
    if (e.pointerId != null) engine.renderer.domElement.setPointerCapture(e.pointerId);
  });
  engine.renderer.domElement.addEventListener('pointerup', (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) >= 5) return;

    const rect = engine.renderer.domElement.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), engine.camera);
    const rayDir: [number, number, number] = [rc.ray.direction.x, rc.ray.direction.y, rc.ray.direction.z];
    const fade = systemFade(nav.viewDistanceAu);

    if (fade > 0.5) {
      const pIdx = pickPlanet([camAu.x, camAu.y, camAu.z], rayDir, currentSystem, PLANET_PICK_ANGLE);
      if (pIdx != null) {
        planetPanel.show(currentSystem.planets[pIdx]!);
        infoPanel.hide();
        return;
      }
    }

    const fp: [number, number, number] = [
      nav.focusWorldAu[0] / AU_PER_PC,
      nav.focusWorldAu[1] / AU_PER_PC,
      nav.focusWorldAu[2] / AU_PER_PC,
    ];
    const camPc: [number, number, number] = [
      fp[0] + camAu.x / AU_PER_PC,
      fp[1] + camAu.y / AU_PER_PC,
      fp[2] + camAu.z / AU_PER_PC,
    ];
    const sIdx = pickStar(camPc, rayDir, catalog.columns, PICK_ANGLE);
    if (sIdx != null) {
      infoPanel.show(describeStar(catalog.columns, sIdx, starDisplayName(sIdx, catalog.nameOf(sIdx))));
      planetPanel.hide();
    } else {
      infoPanel.hide();
      planetPanel.hide();
    }
  });

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
    const fade = systemFade(nav.viewDistanceAu);
    const near = nearestStarPc(fp, catalog.columns);
    if (near.index !== nav.focusStarIndex) {
      const fi = nav.focusStarIndex;
      const curDist = Math.hypot(
        catalog.columns.x[fi]! - fp[0], catalog.columns.y[fi]! - fp[1], catalog.columns.z[fi]! - fp[2],
      );
      // 星系境界での往復切替を防ぐヒステリシス
      if (near.distPc < curDist * FOCUS_HYSTERESIS) nav.focusStarIndex = near.index;
    }
    // 可視かつ古いときだけ系を再構築（フェード中=不可視での毎フレーム再構築を回避）
    if (fade > 0 && currentSystem.starIndex !== nav.focusStarIndex) {
      currentSystem = rebuildSystem(nav.focusStarIndex);
    }
    field.setFocus(fp, nav.focusStarIndex);

    // --- フェード（ズームアウトで恒星系→星野へ） ----------------------------
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

    // --- ラベル（星名 / 惑星名+距離） ------------------------------------
    const labelItems: LabelItem[] = [];
    if (fade > 0.5) {
      labelItems.push({ text: starDisplayName(currentSystem.starIndex, currentSystem.starName), worldPos: [0, 0, 0] });
      currentSystem.planets.forEach((p, i) => {
        const [px, py, pz] = orbitPosition(p.semiMajorAxisAu, planetPhase(currentSystem.starIndex, i));
        labelItems.push({ text: `${p.name}  ${formatAuDistance(p.semiMajorAxisAu)}`, worldPos: [px, py, pz] });
      });
    } else {
      const cols = catalog.columns;
      for (const s of nearestStarsPc(fp, cols, 15)) {
        const px = cols.x[s.index]!, py = cols.y[s.index]!, pz = cols.z[s.index]!;
        const worldPos: [number, number, number] = [
          (px - fp[0]) * AU_PER_PC, (py - fp[1]) * AU_PER_PC, (pz - fp[2]) * AU_PER_PC,
        ];
        const distSolPc = Math.hypot(px, py, pz);
        const name = starDisplayName(s.index, catalog.nameOf(s.index));
        labelItems.push({ text: `${name}  ${(distSolPc * PARSEC_IN_LY).toFixed(1)} 光年`, worldPos });
      }
    }
    slider.setReadout(speedFromSlider(slider.value()), starDisplayName(currentSystem.starIndex, currentSystem.starName));

    engine.render();
    // ラベルは engine.render() の後に投影する。render 内で camera.matrixWorldInverse が更新されるため、
    // 星/惑星と同じ最新姿勢で位置が決まり、ドラッグ/ズーム中に1フレーム遅れて追従するのを防ぐ。
    labels.render(labelItems, engine.camera, engine.renderer.domElement);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
