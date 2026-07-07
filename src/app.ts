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
import { MILKY_WAY, ANDROMEDA } from './galaxy/galaxyParams';
import { localGroupFade, localGroupOpacities, andromedaFade } from './nav/localGroupFade';
import { PLANET_FACTS, SUN_FACTS, earthClosestApproachAu, formatOrbitalKmH } from './system/solarFacts';
import { EmitButton } from './ui/EmitButton';
import { LightBar } from './ui/LightBar';
import { DiameterRuler } from './ui/DiameterRuler';
import { pulseGrowthAuPerSec } from './edu/lightPulse';
import { barStops, barRightAu, barFraction, barReadoutText } from './edu/lightBar';

const DRAG_SENS = 0.005;
const ZOOM_SENS = 0.0015;
const PICK_ANGLE = 0.02;
const PLANET_PICK_ANGLE = 0.05;
const SUN_PICK_ANGLE = 0.06; // 太陽(原点)クリック判定の角度（live-tune）
const FOCUS_HYSTERESIS = 0.9; // 新しい最近傍星へ切り替える距離マージン（境界での往復防止）
const GALAXY_STAGE_MIN_AU = 1e6; // これ以上のズームでは星ラベル/焦点切替が無い（scaleInfo の galaxy 下限）
const AU_PER_LY = 63241.077; // 直径定規ラベルを radiusAu から導くための換算

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

  // 光速バー（画面上部・地球基準で光の遅さを体感）
  const barStopList = barStops();
  const barRight = barRightAu(barStopList);
  const lightBar = new LightBar(root, barStopList, barRight);
  let pulseActive = false;
  let pulseDistAu = 0;   // 地球から光が進んだ距離(AU)
  let pulseDoneSec = 0;  // 右端(海王星)到達後の経過（消去用）
  new EmitButton(root, () => {
    pulseActive = true; // 押すたび先頭から再発射
    pulseDistAu = 0;
    pulseDoneSec = 0;
  });

  // 天体の直径定規（見えている主天体の実幅＋直径ラベル）
  const ruler = new DiameterRuler(root);

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
    // 別の星系へ移ったら旧星系の情報パネルを閉じる（残留防止）
    infoPanel.hide();
    planetPanel.hide();
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

  // 天体中心＋実半径をスクリーン座標へ投影し、直径定規の左右端(px)と縦位置を返す。
  // カメラ行列は engine.render() 後に最新化されるため、この関数は描画後に呼ぶこと。
  const _rc = new THREE.Vector3();
  const _re = new THREE.Vector3();
  const _rRight = new THREE.Vector3();
  const _rUp = new THREE.Vector3();
  function objectScreenExtent(center: [number, number, number], radiusWorld: number):
    { cx: number; cy: number; halfW: number; vHalf: number } | null {
    const w = engine.renderer.domElement.clientWidth;
    const h = engine.renderer.domElement.clientHeight;
    _rc.set(center[0], center[1], center[2]);
    _rRight.setFromMatrixColumn(engine.camera.matrixWorld, 0); // カメラ右方向（正規化済）
    _rUp.setFromMatrixColumn(engine.camera.matrixWorld, 1);    // カメラ上方向
    _re.copy(_rc).project(engine.camera);                      // 中心の NDC
    if (_re.z < -1 || _re.z > 1) return null;                  // カメラ背後/クリップ範囲外
    const cx = (_re.x * 0.5 + 0.5) * w;
    const cy = (-_re.y * 0.5 + 0.5) * h;
    _re.copy(_rc).addScaledVector(_rRight, radiusWorld).project(engine.camera);
    const halfW = Math.abs((_re.x * 0.5 + 0.5) * w - cx);
    _re.copy(_rc).addScaledVector(_rUp, radiusWorld).project(engine.camera);
    const vHalf = Math.abs((-_re.y * 0.5 + 0.5) * h - cy);
    return { cx, cy, halfW, vHalf };
  }

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

      // 中心星（原点の星球）クリックを角度で先取り。太陽は銀河公転の詳細、他の恒星は通常の星情報。
      // 星系は原点に描画されカタログ実座標とはズレるため、pickStar では中心星を拾えない（太陽以外も救済）。
      const sun = ss.sunWorldPos();
      const dx = sun[0] - camAu.x, dy = sun[1] - camAu.y, dz = sun[2] - camAu.z;
      const dlen = Math.hypot(dx, dy, dz) || 1;
      const sunDot = (dx * rayDir[0] + dy * rayDir[1] + dz * rayDir[2]) / dlen;
      if (sunDot > Math.cos(SUN_PICK_ANGLE)) {
        if (currentSystem.starIndex === 0) {
          planetPanel.showText(sunGalacticText());
          infoPanel.hide();
        } else {
          infoPanel.show(describeStar(
            catalog.columns, currentSystem.starIndex,
            starDisplayName(currentSystem.starIndex, currentSystem.starName),
          ));
          planetPanel.hide();
        }
        return;
      }
    }

    // 星野が完全に消える最遠段（localGroupFade>=1）だけカタログ星のピックを止める。見えている点は
    // 渦巻き銀河のパーティクルでカタログ星ではないため。6.5e9〜1e10 では星が半分見えておりクリック可
    // にする（旧: stage==='localgroup' で 6.5e9 から遮断し、見えている星が押せなかった）。
    if (localGroupFade(nav.viewDistanceAu) >= 1) {
      infoPanel.hide();
      planetPanel.hide();
      return;
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
    // 焦点星の切替は星が見える範囲（銀河ステージ未満）でのみ行う。銀河・局部銀河群スケールでは
    // per-star 情報が無く、全カタログ O(n) の最近傍走査を毎フレーム回すのは無駄。
    if (nav.viewDistanceAu < GALAXY_STAGE_MIN_AU) {
      const near = nearestStarPc(fp, catalog.columns);
      if (near.index !== nav.focusStarIndex) {
        const fi = nav.focusStarIndex;
        const curDist = Math.hypot(
          catalog.columns.x[fi]! - fp[0], catalog.columns.y[fi]! - fp[1], catalog.columns.z[fi]! - fp[2],
        );
        // 星系境界での往復切替を防ぐヒステリシス
        if (near.distPc < curDist * FOCUS_HYSTERESIS) nav.focusStarIndex = near.index;
      }
    }
    // 可視かつ古いときだけ系を再構築（フェード中=不可視での毎フレーム再構築を回避）
    if (fade > 0 && currentSystem.starIndex !== nav.focusStarIndex) {
      currentSystem = rebuildSystem(nav.focusStarIndex);
    }
    // 系ビューが見えている時だけ焦点星を星野から隠す（系ビューの中心星と二重表示にしないため）。
    // fade==0（恒星間・銀河）では系ビューが非表示なので、隠したままだと最近傍星だけが星野から
    // 消えてラベルだけ浮く。-1 を渡して復活させる。
    field.setFocus(fp, fade > 0 ? nav.focusStarIndex : -1);

    // --- フェード（ズームアウトで恒星系→星野へ） ----------------------------
    if (systemScene) {
      systemScene.update(animT);
      systemScene.root.traverse((o) => {
        const mat = (o as THREE.Mesh).material;
        if (!mat) return;
        for (const m of Array.isArray(mat) ? mat : [mat]) {
          // 各マテリアルの基準不透明度（軌道リング 0.85 / 惑星の環 0.7 等）に fade を掛ける。
          // m.opacity=fade で上書きすると、これらの調整値が毎フレーム潰れて常に不透明になる。
          const base = (m.userData.baseOpacity ??= m.opacity);
          m.transparent = true;
          m.opacity = base * fade;
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
    const lgOpacities = localGroupOpacities(nav.viewDistanceAu);
    localGroup.setOpacities(lgOpacities.milkyWay, lgOpacities.andromeda);
    localGroup.setPosition(-nav.focusWorldAu[0], -nav.focusWorldAu[1], -nav.focusWorldAu[2]);
    localGroup.update(animT);
    field.setOpacity(1 - lgFade);
    field.object.visible = lgFade < 1; // 星野が完全に消える最遠段では描画自体をスキップ
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
      const andFade = andromedaFade(nav.viewDistanceAu);
      if (andFade < 0.35) {
        // 天の川が主役。2ラベルは円盤面(y≈0)上で重なるため dyPx で縦分離。
        labelItems.push({ text: '天の川銀河（現在地）', worldPos: localGroup.markerWorldPos(), dyPx: -14 });
        labelItems.push({
          text: `太陽の銀河公転 ・ 約${(SUN_FACTS.galacticPeriodYr / 1e8).toPrecision(2)}億年で1周（半径約${(SUN_FACTS.galacticCenterLy / 1e4).toFixed(1)}万光年）`,
          worldPos: localGroup.galacticCenterWorldPos(),
          dyPx: 14,
        });
      } else if (andFade <= 0.65) {
        // クロスフェード中: 2銀河の中点に距離ラベル
        labelItems.push({ text: '← 約250万光年 → アンドロメダ銀河へ', worldPos: localGroup.midpointWorldPos() });
      } else {
        // アンドロメダが主役（原点中心＝markerWorldPos が示す画面中央）
        labelItems.push({ text: 'アンドロメダ銀河（M31）・天の川から約250万光年', worldPos: localGroup.markerWorldPos() });
      }
    }
    // スライダーの「対象:」は実際の焦点星（nav.focusStarIndex）を表示する。currentSystem は
    // fade==0 の間は再構築されず古い星名のまま固着するため、それを参照しない。
    slider.setReadout(speedFromSlider(slider.value()), starDisplayName(nav.focusStarIndex, catalog.nameOf(nav.focusStarIndex)));
    // スケールが銀河以遠になったら系ビューの情報パネルは無関係になるので閉じる（残留防止）。
    if (scaleInfo.stage === 'galaxy' || scaleInfo.stage === 'localgroup') { infoPanel.hide(); planetPanel.hide(); }
    else if (fade <= 0.5) planetPanel.hide(); // 惑星パネルは系ビュー（fade>0.5）でのみ有効

    // --- 天体の直径定規：見えている主天体の中心と実半径（world=AU）を決める ---
    // （投影は engine.render() 後に objectScreenExtent で行う）
    let rulerInfo: { center: [number, number, number]; radiusWorld: number; label: string } | null = null;
    if (fade > 0.5 && systemScene && currentSystem.starIndex === 0) {
      const outerAu = Math.max(...currentSystem.planets.map((p) => p.semiMajorAxisAu)); // 海王星軌道
      rulerInfo = { center: systemScene.sunWorldPos(), radiusWorld: outerAu, label: '太陽系 ・ 直径 約90億km（光で約8時間）' };
    } else if (lgFade > 0.5) {
      // ラベルの直径は radiusAu から導く（線の実長とラベル数値を必ず一致させる）。
      const mwWanLy = Math.round((2 * MILKY_WAY.radiusAu) / AU_PER_LY / 1e4);
      const andWanLy = Math.round((2 * ANDROMEDA.radiusAu) / AU_PER_LY / 1e4);
      rulerInfo = andromedaFade(nav.viewDistanceAu) < 0.5
        ? { center: localGroup.galacticCenterWorldPos(), radiusWorld: MILKY_WAY.radiusAu, label: `天の川銀河 ・ 直径 約${mwWanLy}万光年` }
        : { center: localGroup.markerWorldPos(), radiusWorld: ANDROMEDA.radiusAu, label: `アンドロメダ銀河 ・ 直径 約${andWanLy}万光年` };
    }

    // --- 光速バー（地球から放った光が惑星へ届く様子で光の遅さを体感） -------
    if (pulseActive) {
      if (!paused) pulseDistAu += pulseGrowthAuPerSec() * dt;
      const frac = barFraction(pulseDistAu, barRight);
      lightBar.update(frac, barReadoutText(pulseDistAu, barStopList));
      if (frac >= 1) {
        // 海王星（右端）到達。少し見せてから消す。
        if (!paused) pulseDoneSec += dt;
        if (pulseDoneSec > 3) { pulseActive = false; lightBar.hide(); }
      }
    }

    engine.render();
    // ラベルは engine.render() の後に投影する。render 内で camera.matrixWorldInverse が更新されるため、
    // 星/惑星と同じ最新姿勢で位置が決まり、ドラッグ/ズーム中に1フレーム遅れて追従するのを防ぐ。
    labels.render(labelItems, engine.camera, engine.renderer.domElement);

    // 直径定規は render 後（カメラ行列が最新）に投影して配置する。
    if (rulerInfo) {
      const ext = objectScreenExtent(rulerInfo.center, rulerInfo.radiusWorld);
      const screenW = engine.renderer.domElement.clientWidth;
      // 天体がビューより十分大きい（=ズームインで画面を突き抜けている）と定規の両端も
      // ラベルも画面外に出て、正体不明の全幅線だけが残る。そういう時は定規を出さない。
      if (ext && ext.halfW <= screenW) {
        const yPx = Math.min(ext.cy + ext.vHalf + 12, engine.renderer.domElement.clientHeight - 150); // 下部UI(発射/停止ボタン)を避ける
        ruler.update(ext.cx - ext.halfW, ext.cx + ext.halfW, yPx, rulerInfo.label);
      } else {
        ruler.hide();
      }
    } else {
      ruler.hide();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
