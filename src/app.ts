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
import { PauseButton } from './ui/PauseButton';
import { ControlHints } from './ui/ControlHints';
import { pickStar } from './selection/Picker';
import { pickPlanet } from './system/planetPick';
import { InfoPanel } from './ui/InfoPanel';
import { PlanetPanel } from './ui/PlanetPanel';
import { describeStar, formatAuDistance, starDisplayName } from './ui/format';
import { nearestStarPc } from './nav/nearestStar';
import { LabelLayer, type LabelItem } from './ui/LabelLayer';
import { nearestStarsPc } from './nav/nearestStars';
import { PARSEC_IN_LY } from './astro/spectral';
import { ScalePanel } from './ui/ScalePanel';
import { scaleInfoFor } from './edu/scaleInfo';
import { scaleBarFor } from './edu/scaleBar';
import { ScaleBar } from './ui/ScaleBar';
import { LocalGroup } from './galaxy/LocalGroup';
import { localGroupFade } from './nav/localGroupFade';
import { PLANET_FACTS, SUN_FACTS, earthClosestApproachAu, formatOrbitalKmH } from './system/solarFacts';

const DRAG_SENS = 0.005;
const ZOOM_SENS = 0.0015;
const PICK_ANGLE = 0.02;
const PLANET_PICK_ANGLE = 0.05;
const SUN_PICK_ANGLE = 0.06; // 太陽(原点)クリック判定の角度（live-tune）
const FOCUS_HYSTERESIS = 0.9; // 新しい最近傍星へ切り替える距離マージン（境界での往復防止）

function sunGalacticText(): string {
  return `太陽\n銀河公転: ${SUN_FACTS.galacticSpeedKmS} km/s（銀河を約${(SUN_FACTS.galacticPeriodYr / 1e8).toPrecision(2)}億年で1周）\n` +
    `銀河中心まで: 約${SUN_FACTS.galacticCenterLy / 1e4}万光年\n` +
    `自転: 赤道 約${SUN_FACTS.rotationSpeedKmH} km/h`;
}

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
  let paused = false;
  function togglePause(): void { paused = !paused; pauseButton.setPaused(paused); }
  const pauseButton = new PauseButton(root, togglePause);
  new ControlHints(root);
  const infoPanel = new InfoPanel(root);
  const planetPanel = new PlanetPanel(root);
  const labels = new LabelLayer(root);
  const scalePanel = new ScalePanel(root);
  const scaleBar = new ScaleBar(root);
  const localGroup = new LocalGroup();

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
  engine.scene.add(localGroup.object);

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

    if (fade > 0.5 && systemScene) {
      const ss = systemScene;
      const positions = currentSystem.planets.map((_, i) => ss.planetWorldPos(i));
      const pIdx = pickPlanet([camAu.x, camAu.y, camAu.z], rayDir, positions, PLANET_PICK_ANGLE);
      if (pIdx != null) {
        const planet = currentSystem.planets[pIdx]!;
        if (currentSystem.starIndex === 0) {
          planetPanel.show(planet, PLANET_FACTS[pIdx], earthClosestApproachAu(planet.semiMajorAxisAu));
        } else {
          planetPanel.show(planet);
        }
        infoPanel.hide();
        return;
      }

      if (currentSystem.starIndex === 0) {
        const sun = ss.sunWorldPos();
        const dx = sun[0] - camAu.x, dy = sun[1] - camAu.y, dz = sun[2] - camAu.z;
        const dlen = Math.hypot(dx, dy, dz) || 1;
        const sunDot = (dx * rayDir[0] + dy * rayDir[1] + dz * rayDir[2]) / dlen;
        if (sunDot > Math.cos(SUN_PICK_ANGLE)) {
          planetPanel.showText(sunGalacticText());
          infoPanel.hide();
          return;
        }
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
      if (currentSystem.starIndex === 0 && sIdx === 0) {
        planetPanel.showText(sunGalacticText());
        infoPanel.hide();
      } else {
        infoPanel.show(describeStar(catalog.columns, sIdx, starDisplayName(sIdx, catalog.nameOf(sIdx))));
        planetPanel.hide();
      }
    } else {
      infoPanel.hide();
      planetPanel.hide();
    }
  });

  let last = performance.now();
  let animT = 0;
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (!paused) animT += dt;
    if (input.consumePauseToggle()) togglePause();

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
      systemScene.update(animT);
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
    const scaleInfo = scaleInfoFor(nav.viewDistanceAu);
    scalePanel.update(scaleInfo);
    scaleBar.update(scaleBarFor(
      nav.viewDistanceAu,
      engine.renderer.domElement.clientHeight,
      engine.camera.fov * Math.PI / 180,
    ));
    scaleBar.setVisible(scaleInfo.stage !== 'localgroup');
    const lgFade = localGroupFade(nav.viewDistanceAu);
    localGroup.object.visible = lgFade > 0;
    localGroup.setOpacity(lgFade);
    localGroup.setPosition(-nav.focusWorldAu[0], -nav.focusWorldAu[1], -nav.focusWorldAu[2]);
    localGroup.update(animT);
    field.setOpacity(1 - lgFade);
    const labelItems: LabelItem[] = [];
    if (fade > 0.5 && systemScene) {
      const ss = systemScene;
      const isSolar = currentSystem.starIndex === 0;
      if (isSolar) {
        labelItems.push({
          text: `太陽 ・ 公転 ${SUN_FACTS.galacticSpeedKmS}km/s（クリックで詳細）`,
          worldPos: ss.sunWorldPos(),
        });
      } else {
        labelItems.push({ text: starDisplayName(currentSystem.starIndex, currentSystem.starName), worldPos: ss.sunWorldPos() });
      }
      currentSystem.planets.forEach((p, i) => {
        const [px, py, pz] = ss.planetWorldPos(i);
        if (isSolar) {
          const f = PLANET_FACTS[i]!;
          const rotKmh = f.rotationSpeedKmH.toLocaleString('en-US');
          labelItems.push({
            text: `${p.name}  ${formatAuDistance(p.semiMajorAxisAu)}\n公転 ${formatOrbitalKmH(f.orbitalSpeedKmS)}\n自転 ${rotKmh} km/h${f.retrograde ? '(逆)' : ''}`,
            worldPos: [px, py, pz],
          });
        } else {
          labelItems.push({ text: `${p.name}  ${formatAuDistance(p.semiMajorAxisAu)}`, worldPos: [px, py, pz] });
        }
      });
    } else if (scaleInfo.stage !== 'galaxy' && scaleInfo.stage !== 'localgroup') {
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
    if (lgFade > 0.5) {
      labelItems.push({ text: '現在地（太陽系）', worldPos: localGroup.markerWorldPos() });
      labelItems.push({ text: '約250万光年', worldPos: localGroup.midpointWorldPos() });
      labelItems.push({
        text: `太陽の銀河公転 ・ 約${(SUN_FACTS.galacticPeriodYr / 1e8).toPrecision(2)}億年で1周（半径約${(SUN_FACTS.galacticCenterLy / 1e4).toFixed(1)}万光年）`,
        worldPos: localGroup.galacticCenterWorldPos(),
      });
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
