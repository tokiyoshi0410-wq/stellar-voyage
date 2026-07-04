# stellar-voyage 連続ズーム航法 UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 現行の galaxy/system 2 モードを、太陽系を見下ろす宇宙船視点で始まりマウスドラッグ+ホイール+WASD+速度スライダーで直感的に操作し、ズームで銀河へ連続遷移する単一の連続ズーム航法へ作り替える。

**Architecture:** フォーカス星を常に scene 原点に置く単一 AU 単位ワールドに統一（`FloatingOrigin` + 対数深度で 0.05 AU〜10¹⁰ AU を 1 シーン描画）。カメラはフォーカスを周回（ドラッグ=周回、ホイール=ズーム、WASD=フォーカス平行移動、スライダー=速度）。`viewDistanceAu` に応じたクロスフェードで系ディテール ⇄ 銀河星野を継ぎ目なく切替える。M1/M2a の描画・データ資産は再利用し、操作系とスケール遷移だけを置換する。

**Tech Stack:** TypeScript 5.9、Three.js、Vite 7、vitest 3。追加ランタイム依存なし。

## Global Constraints

- パッケージマネージャ npm、`"type": "module"`。ランタイム依存は Three.js のみ。
- 全ユーザー向け文言は**日本語**。
- ワールド単位は **AU**。銀河星は `pc × AU_PER_PC(206264.8)` で AU 化。フォーカス星が scene 原点。
- 座標精度は `FloatingOrigin`（float64 世界 → float32 カメラ相対）+ 対数深度バッファを厳守。
- TS strict + `noUncheckedIndexedAccess` ON（配列/Float32Array 添字は `!`、既存慣習に従う）。
- テストは vitest。純粋ロジック（カメラ計算・フェード曲線・航法状態・太陽系データ・速度写像）を単体テスト。描画・遷移・操作感は Playwright 目視（コントローラが実施）。
- コミットはタスク単位。メッセージ末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。署名エラー時は `git -c commit.gpgsign=false commit`、`--no-verify` は使わない。
- ビルド系コマンドは監査 hook 発火時に末尾 `# CLAUDE_AUDIT_OK`（変更が test 済み・隔離済みの場合）。

## 既存モジュール（このプランが再利用/依存する実シグネチャ）

- `catalog/format.ts`: `StarColumns { count; x/y/z/mag/absmag/ci: Float32Array }`（x/y/z はパーセク）
- `catalog/StarCatalog.ts`: `StarCatalog { columns; names; static load; nameOf(index) }`
- `catalog/exoplanets.ts`: `loadExoplanets(url): Promise<Record<number, Planet[]>>`
- `astro/spectral.ts`: `absMagToLuminosity`, `temperatureToSpectralClass`; `astro/color.ts`: `bvToTemperature`
- `engine/Renderer.ts`: `Renderer { scene; camera; renderer; resize; render(); dispose() }`（対数深度）, `isWebGL2Available`
- `engine/FloatingOrigin.ts`: `FloatingOrigin { position:[number,number,number]; setPosition; translate; relative }`
- `starfield/StarField.ts`: `StarField { object: THREE.Points; constructor(columns); updateOrigin(origin) }`, `buildStarGeometry(columns)`
- `system/types.ts`: `Planet { name; type: PlanetType; semiMajorAxisAu; radiusEarth; massEarth; eqTempK; inHabitableZone; isReal; estimated }`, `PlanetType`, `StellarSystem`
- `system/habitableZone.ts`: `inHabitableZone(a, L)`; `system/planetGen.ts`: `generatePlanets`
- `system/StellarSystem.ts`: `buildStellarSystem(columns, index, name, exoplanets?)`
- `system/SystemScene.ts`: `SystemScene { root: THREE.Group; planetMeshes; constructor(system); dispose() }`, `planetTypeColor`
- `system/orbit.ts`: `orbitPosition(a, phase)`, `planetPhase(starIndex, planetIndex)`
- `planets/PlanetMaterial.ts`: `makePlanetMaterial(type, seed, starDir)`
- `selection/Picker.ts`: `pickStar(cameraPos, rayDir, columns, maxAngleRad)`; `system/planetPick.ts`: `pickPlanet(...)`
- `ui/InfoPanel.ts`, `ui/PlanetPanel.ts`, `ui/format.ts`（`describeStar`）
- `astro/spectral.ts`: `PARSEC_IN_LY = 3.2615637769`
- 現行 `app.ts`: `startApp(root)`, `showFatal(root, msg)`（galaxy/system モード分岐あり — 本プランで置換）

## File Structure

```
src/
  system/
    solarSystem.ts      # 本物の太陽系 8 惑星データ（新規）
  nav/
    orbitCamera.ts      # (focus, yaw, pitch, distance) → カメラ位置・注視点（純粋）
    fade.ts             # viewDistanceAu → systemFade（純粋）
    speed.ts            # スライダー値 → 速度(AU/s)（純粋）
    NavigationController.ts  # focus/orbit/zoom/translate/focus 切替 状態機械
    InputMapper.ts      # ドラッグ/ホイール/WASD → 意図
  ui/
    SpeedSlider.ts      # 速度スライダー + 現在速度/フォーカス名（DOM）
    ControlHints.ts     # 操作ヒント（DOM）
  starfield/StarField.ts (改修)  # フォーカス相対描画 + フォーカス星の点を隠す
  system/SystemScene.ts (改修)   # hasRing 惑星に環を描画
  system/types.ts (改修)         # Planet に hasRing?: boolean
  system/StellarSystem.ts (改修) # index 0 → 太陽系
  app.ts (改修)                   # モード分岐撤去、単一シーン + NavigationController + 新入力
tests/ …（各純粋モジュールに対応）
```

---

### Task 1: 太陽系データ（本物の 8 惑星）

**Files:**
- Create: `src/system/solarSystem.ts`
- Modify: `src/system/types.ts`（`Planet` に `hasRing?: boolean` 追加）
- Test: `tests/system/solarSystem.test.ts`

**Interfaces:**
- Consumes: `Planet`/`PlanetType`（types）, `inHabitableZone`（habitableZone）
- Produces: `getSolarSystem(): Planet[]`（水金地火木土天海の 8 惑星、実軌道・相対サイズ・型・土星のみ `hasRing:true`）

- [ ] **Step 1: 失敗するテストを書く**

`tests/system/solarSystem.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getSolarSystem } from '../../src/system/solarSystem';

describe('getSolarSystem', () => {
  const s = getSolarSystem();
  it('has the 8 planets in ascending orbit order', () => {
    expect(s.length).toBe(8);
    expect(s.map((p) => p.name)).toEqual(['水星','金星','地球','火星','木星','土星','天王星','海王星']);
    let prev = 0;
    for (const p of s) { expect(p.semiMajorAxisAu).toBeGreaterThan(prev); prev = p.semiMajorAxisAu; }
  });
  it('earth is in the habitable zone, mars and venus are not', () => {
    const by = (n: string) => s.find((p) => p.name === n)!;
    expect(by('地球').inHabitableZone).toBe(true);
    expect(by('火星').inHabitableZone).toBe(false);
    expect(by('金星').inHabitableZone).toBe(false);
  });
  it('assigns sensible types and only Saturn has a ring', () => {
    const by = (n: string) => s.find((p) => p.name === n)!;
    expect(by('地球').type).toBe('ocean');
    expect(by('木星').type).toBe('gas');
    expect(by('海王星').type).toBe('ice');
    expect(s.filter((p) => p.hasRing).map((p) => p.name)).toEqual(['土星']);
    for (const p of s) { expect(p.isReal).toBe(true); expect(p.radiusEarth).toBeGreaterThan(0); }
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- solarSystem`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 実装**

`src/system/types.ts` の `Planet` に 1 行追加（既存フィールドの後ろ、任意プロパティ）:
```ts
  estimated: boolean;
  hasRing?: boolean;
```

`src/system/solarSystem.ts`:
```ts
import type { Planet, PlanetType } from './types';
import { inHabitableZone } from './habitableZone';

interface SolarDef { name: string; type: PlanetType; a: number; r: number; hasRing?: boolean }

const SOLAR: SolarDef[] = [
  { name: '水星', type: 'rock',  a: 0.39, r: 0.38 },
  { name: '金星', type: 'rock',  a: 0.72, r: 0.95 },
  { name: '地球', type: 'ocean', a: 1.00, r: 1.00 },
  { name: '火星', type: 'rock',  a: 1.52, r: 0.53 },
  { name: '木星', type: 'gas',   a: 5.20, r: 11.2 },
  { name: '土星', type: 'gas',   a: 9.58, r: 9.45, hasRing: true },
  { name: '天王星', type: 'ice', a: 19.2, r: 4.01 },
  { name: '海王星', type: 'ice', a: 30.1, r: 3.88 },
];

const DENSITY: Record<PlanetType, number> = { rock: 1.0, ocean: 0.7, ice: 0.4, gas: 0.2 };

// 太陽系（太陽光度 = 1 でハビタブルゾーン判定）
export function getSolarSystem(): Planet[] {
  return SOLAR.map((d) => ({
    name: d.name,
    type: d.type,
    semiMajorAxisAu: d.a,
    radiusEarth: d.r,
    massEarth: DENSITY[d.type] * Math.pow(d.r, 3),
    eqTempK: null,
    inHabitableZone: inHabitableZone(d.a, 1),
    isReal: true,
    estimated: false,
    hasRing: d.hasRing ?? false,
  }));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- solarSystem`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/system/solarSystem.ts src/system/types.ts tests/system/solarSystem.test.ts
git -c commit.gpgsign=false commit -m "feat: add real Solar System 8-planet data" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: buildStellarSystem を太陽系対応

**Files:**
- Modify: `src/system/StellarSystem.ts`
- Test: `tests/system/stellarSystem.test.ts`（既存に追記）

**Interfaces:**
- Consumes: `getSolarSystem`（Task 1）
- Produces: `buildStellarSystem(columns, index, name, exoplanets?)` — `index === 0` のとき惑星に太陽系を使う（他は従来どおり実データ優先 or 手続き生成）

- [ ] **Step 1: 失敗するテストを追記**

`tests/system/stellarSystem.test.ts` に追記:
```ts
import { getSolarSystem } from '../../src/system/solarSystem';

describe('buildStellarSystem solar system', () => {
  const columns = {
    count: 1,
    x: new Float32Array([0]), y: new Float32Array([0]), z: new Float32Array([0]),
    mag: new Float32Array([-26.7]), absmag: new Float32Array([4.85]), ci: new Float32Array([0.656]),
  };
  it('returns the real Solar System for index 0', () => {
    const sys = buildStellarSystem(columns, 0, 'Sol');
    expect(sys.planets.map((p) => p.name)).toEqual(getSolarSystem().map((p) => p.name));
    expect(sys.planets.length).toBe(8);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- stellarSystem`
Expected: FAIL（index 0 が太陽系を返さない）

- [ ] **Step 3: 実装**

`src/system/StellarSystem.ts` の planets 決定ロジックを変更（`import { getSolarSystem } from './solarSystem';` を追加）:
```ts
  const real = exoplanets?.[index];
  const planets = index === 0
    ? getSolarSystem()
    : real && real.length > 0
      ? real.map((p) => ({ ...p, inHabitableZone: inHabitableZone(p.semiMajorAxisAu, luminositySun) }))
      : generatePlanets(index, spectralClass, luminositySun);
```
（`inHabitableZone` は既存 import 済み。太陽系側は L=1 で判定済みのため再計算不要。）

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- stellarSystem`
Expected: PASS（既存 + 新規）。`npm test` 全体も緑。

- [ ] **Step 5: コミット**

```bash
git add src/system/StellarSystem.ts tests/system/stellarSystem.test.ts
git -c commit.gpgsign=false commit -m "feat: use real Solar System for star index 0" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 周回カメラ計算（純粋）

**Files:**
- Create: `src/nav/orbitCamera.ts`
- Test: `tests/nav/orbitCamera.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `orbitCameraPosition(focus: [number,number,number], yaw: number, pitch: number, distance: number): { position: [number,number,number]; target: [number,number,number] }`
  - カメラは focus を中心に距離 distance で周回。`pitch > 0` でカメラが focus より上（見下ろし）。`yaw=0, pitch=0` で `focus + (0,0,distance)`、注視点は focus。

- [ ] **Step 1: 失敗するテストを書く**

`tests/nav/orbitCamera.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { orbitCameraPosition } from '../../src/nav/orbitCamera';

describe('orbitCameraPosition', () => {
  it('at yaw0/pitch0 sits at focus + (0,0,distance) looking at focus', () => {
    const { position, target } = orbitCameraPosition([1, 2, 3], 0, 0, 10);
    expect(position[0]).toBeCloseTo(1, 6);
    expect(position[1]).toBeCloseTo(2, 6);
    expect(position[2]).toBeCloseTo(13, 6);
    expect(target).toEqual([1, 2, 3]);
  });
  it('keeps camera at `distance` from focus', () => {
    const { position } = orbitCameraPosition([0, 0, 0], 1.2, 0.5, 7);
    expect(Math.hypot(position[0], position[1], position[2])).toBeCloseTo(7, 5);
  });
  it('positive pitch raises the camera above the focus (look down)', () => {
    const { position } = orbitCameraPosition([0, 0, 0], 0, 0.6, 10);
    expect(position[1]).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- orbitCamera`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/nav/orbitCamera.ts`:
```ts
export function orbitCameraPosition(
  focus: [number, number, number],
  yaw: number,
  pitch: number,
  distance: number,
): { position: [number, number, number]; target: [number, number, number] } {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const dir: [number, number, number] = [Math.sin(yaw) * cp, sp, Math.cos(yaw) * cp];
  return {
    position: [
      focus[0] + dir[0] * distance,
      focus[1] + dir[1] * distance,
      focus[2] + dir[2] * distance,
    ],
    target: [focus[0], focus[1], focus[2]],
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- orbitCamera`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/nav/orbitCamera.ts tests/nav/orbitCamera.test.ts
git -c commit.gpgsign=false commit -m "feat: add orbit camera position math" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: フェード曲線 + 速度写像（純粋）

**Files:**
- Create: `src/nav/fade.ts`, `src/nav/speed.ts`
- Test: `tests/nav/fade.test.ts`, `tests/nav/speed.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - fade: `systemFade(viewDistanceAu: number): number`（≤300 AU→1、≥30000 AU→0、単調減少の smoothstep）
  - speed: `MIN_SPEED_AU_S = 0.5`, `MAX_SPEED_AU_S = 2e6`, `speedFromSlider(v: number): number`（v∈[0,1] を対数スケールで [MIN,MAX] へ）, `formatSpeed(auPerSec: number): string`（AU/秒 と 光年/秒 を切替表示・日本語）

- [ ] **Step 1: 失敗するテストを書く**

`tests/nav/fade.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { systemFade } from '../../src/nav/fade';

describe('systemFade', () => {
  it('is 1 when close and 0 when far', () => {
    expect(systemFade(100)).toBe(1);
    expect(systemFade(300)).toBeCloseTo(1, 6);
    expect(systemFade(30000)).toBeCloseTo(0, 6);
    expect(systemFade(100000)).toBe(0);
  });
  it('decreases monotonically across the band', () => {
    let prev = 1.0001;
    for (let d = 300; d <= 30000; d += 2000) { const f = systemFade(d); expect(f).toBeLessThanOrEqual(prev); prev = f; }
  });
});
```

`tests/nav/speed.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { speedFromSlider, formatSpeed, MIN_SPEED_AU_S, MAX_SPEED_AU_S } from '../../src/nav/speed';

describe('speedFromSlider', () => {
  it('maps 0→MIN and 1→MAX on a log scale, monotonic', () => {
    expect(speedFromSlider(0)).toBeCloseTo(MIN_SPEED_AU_S, 5);
    expect(speedFromSlider(1)).toBeCloseTo(MAX_SPEED_AU_S, 0);
    expect(speedFromSlider(0.5)).toBeGreaterThan(speedFromSlider(0.25));
  });
});
describe('formatSpeed', () => {
  it('shows AU/s when slow and 光年/s when fast, in Japanese', () => {
    expect(formatSpeed(2)).toMatch(/AU\/秒/);
    expect(formatSpeed(500000)).toMatch(/光年\/秒/);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- fade speed`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/nav/fade.ts`:
```ts
export function systemFade(viewDistanceAu: number): number {
  const t = Math.max(0, Math.min(1, (viewDistanceAu - 300) / (30000 - 300)));
  const s = t * t * (3 - 2 * t);
  return 1 - s;
}
```

`src/nav/speed.ts`:
```ts
export const MIN_SPEED_AU_S = 0.5;
export const MAX_SPEED_AU_S = 2e6; // ≈ 9.7 pc/s ≈ 31 光年/秒
const AU_PER_LY = 63241.077;

export function speedFromSlider(v: number): number {
  const t = Math.max(0, Math.min(1, v));
  return MIN_SPEED_AU_S * Math.pow(MAX_SPEED_AU_S / MIN_SPEED_AU_S, t);
}

export function formatSpeed(auPerSec: number): string {
  if (auPerSec < 1000) return `${auPerSec.toFixed(auPerSec < 10 ? 1 : 0)} AU/秒`;
  const lyPerSec = auPerSec / AU_PER_LY;
  return `${lyPerSec.toPrecision(2)} 光年/秒`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- fade speed`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/nav/fade.ts src/nav/speed.ts tests/nav/fade.test.ts tests/nav/speed.test.ts
git -c commit.gpgsign=false commit -m "feat: add system fade curve and speed mapping" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: NavigationController（航法状態機械）

**Files:**
- Create: `src/nav/NavigationController.ts`
- Test: `tests/nav/navigationController.test.ts`

**Interfaces:**
- Consumes: なし（Three 非依存の純粋計算）
- Produces:
  - 定数 `MIN_VIEW_AU = 0.05`, `MAX_VIEW_AU = 5e10`
  - `class NavigationController { focusStarIndex: number; focusWorldAu: [number,number,number]; orbitYaw: number; orbitPitch: number; viewDistanceAu: number; orbit(dYaw, dPitch): void; zoom(factor: number): void; translate(forward: number, right: number, speedAuPerSec: number, dt: number): void; setFocus(index: number, worldAu: [number,number,number]): void }`
  - 初期値: `focusStarIndex=0`, `focusWorldAu=[0,0,0]`, `orbitYaw=0`, `orbitPitch=0.6`, `viewDistanceAu=40`
  - `orbit`: yaw 加算、pitch は [-1.5, 1.5] にクランプ
  - `zoom(factor)`: `viewDistanceAu *= factor`、[MIN_VIEW_AU, MAX_VIEW_AU] にクランプ
  - `translate(f, r, speed, dt)`: focus を view 平面(xz)で移動。yaw0 で W(f=1)→ −Z、D(r=1)→ +X。移動量 `= (forwardDir*f + rightDir*r) * speed * dt`。`forwardDir(yaw)=(-sin,0,-cos)`, `rightDir(yaw)=(cos,0,-sin)`
  - `setFocus`: index と world 位置を差し替え

- [ ] **Step 1: 失敗するテストを書く**

`tests/nav/navigationController.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { NavigationController, MIN_VIEW_AU, MAX_VIEW_AU } from '../../src/nav/NavigationController';

describe('NavigationController', () => {
  it('starts focused on the Sun looking down at ~40 AU', () => {
    const n = new NavigationController();
    expect(n.focusStarIndex).toBe(0);
    expect(n.focusWorldAu).toEqual([0, 0, 0]);
    expect(n.viewDistanceAu).toBe(40);
    expect(n.orbitPitch).toBeGreaterThan(0);
  });
  it('zoom multiplies and clamps view distance', () => {
    const n = new NavigationController();
    n.zoom(2); expect(n.viewDistanceAu).toBe(80);
    n.zoom(1e12); expect(n.viewDistanceAu).toBe(MAX_VIEW_AU);
    n.zoom(0); expect(n.viewDistanceAu).toBe(MIN_VIEW_AU);
  });
  it('orbit clamps pitch to +-1.5', () => {
    const n = new NavigationController();
    n.orbit(0.3, 5); expect(n.orbitPitch).toBeCloseTo(1.5, 6);
    n.orbit(0, -20); expect(n.orbitPitch).toBeCloseTo(-1.5, 6);
    n.orbit(1.0, 0); expect(n.orbitYaw).toBeCloseTo(0.3 + 1.0, 6);
  });
  it('translate moves focus in the view plane (yaw 0: W→-Z, D→+X)', () => {
    const n = new NavigationController();
    n.orbitYaw = 0;
    n.translate(1, 0, 10, 1); // forward 1, speed 10, dt 1 → -Z by 10
    expect(n.focusWorldAu[2]).toBeCloseTo(-10, 5);
    expect(n.focusWorldAu[0]).toBeCloseTo(0, 5);
    n.setFocus(0, [0, 0, 0]);
    n.translate(0, 1, 10, 1); // right 1 → +X by 10
    expect(n.focusWorldAu[0]).toBeCloseTo(10, 5);
  });
  it('setFocus replaces index and world position', () => {
    const n = new NavigationController();
    n.setFocus(42, [5, -3, 8]);
    expect(n.focusStarIndex).toBe(42);
    expect(n.focusWorldAu).toEqual([5, -3, 8]);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- navigationController`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/nav/NavigationController.ts`:
```ts
export const MIN_VIEW_AU = 0.05;
export const MAX_VIEW_AU = 5e10;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export class NavigationController {
  focusStarIndex = 0;
  focusWorldAu: [number, number, number] = [0, 0, 0];
  orbitYaw = 0;
  orbitPitch = 0.6;
  viewDistanceAu = 40;

  orbit(dYaw: number, dPitch: number): void {
    this.orbitYaw += dYaw;
    this.orbitPitch = clamp(this.orbitPitch + dPitch, -1.5, 1.5);
  }

  zoom(factor: number): void {
    this.viewDistanceAu = clamp(this.viewDistanceAu * factor, MIN_VIEW_AU, MAX_VIEW_AU);
  }

  translate(forward: number, right: number, speedAuPerSec: number, dt: number): void {
    const y = this.orbitYaw;
    const fwd: [number, number, number] = [-Math.sin(y), 0, -Math.cos(y)];
    const rgt: [number, number, number] = [Math.cos(y), 0, -Math.sin(y)];
    const d = speedAuPerSec * dt;
    this.focusWorldAu[0] += (fwd[0] * forward + rgt[0] * right) * d;
    this.focusWorldAu[1] += (fwd[1] * forward + rgt[1] * right) * d;
    this.focusWorldAu[2] += (fwd[2] * forward + rgt[2] * right) * d;
  }

  setFocus(index: number, worldAu: [number, number, number]): void {
    this.focusStarIndex = index;
    this.focusWorldAu = [worldAu[0], worldAu[1], worldAu[2]];
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- navigationController`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/nav/NavigationController.ts tests/nav/navigationController.test.ts
git -c commit.gpgsign=false commit -m "feat: add navigation controller (orbit, zoom, translate, focus)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: InputMapper（ドラッグ/ホイール/WASD）

**Files:**
- Create: `src/nav/InputMapper.ts`
- Test: `tests/nav/inputMapper.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `class InputMapper { constructor(target: HTMLElement); consumeDrag(): { dx: number; dy: number }; consumeWheel(): number; movement(): { forward: number; right: number }; dispose(): void }`
  - ドラッグ: `pointerdown` で開始、押下中の `pointermove` の movementX/Y を累積、`pointerup`/`pointercancel` で終了。`consumeDrag` で取り出しリセット。
  - ホイール: `wheel` の deltaY を累積、`consumeWheel` で取り出しリセット（正=ズームアウト方向の生値、変換は呼出側）。
  - WASD: keydown/keyup で状態保持。`movement()` は `forward = (W?1:0)-(S?1:0)`, `right = (D?1:0)-(A?1:0)`。

- [ ] **Step 1: 失敗するテストを書く**

`tests/nav/inputMapper.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { InputMapper } from '../../src/nav/InputMapper';

function makeTarget() {
  const L: Record<string, ((e: any) => void)[]> = {};
  return {
    el: { addEventListener: (t: string, cb: any) => { (L[t] ??= []).push(cb); }, removeEventListener: () => {} } as unknown as HTMLElement,
    fire: (t: string, e: any) => { (L[t] ?? []).forEach((cb) => cb(e)); },
  };
}

describe('InputMapper', () => {
  it('accumulates drag only while pointer is down', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    t.fire('pointermove', { movementX: 5, movementY: 5 }); // not down → ignored
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });
    t.fire('pointerdown', {}); t.fire('pointermove', { movementX: 3, movementY: -2 });
    expect(m.consumeDrag()).toEqual({ dx: 3, dy: -2 });
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });
    t.fire('pointerup', {}); t.fire('pointermove', { movementX: 9, movementY: 9 });
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });
  });
  it('accumulates and resets wheel', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    t.fire('wheel', { deltaY: 100 }); t.fire('wheel', { deltaY: 20 });
    expect(m.consumeWheel()).toBe(120);
    expect(m.consumeWheel()).toBe(0);
  });
  it('maps WASD to forward/right', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    t.fire('keydown', { code: 'KeyW' }); t.fire('keydown', { code: 'KeyD' });
    expect(m.movement()).toEqual({ forward: 1, right: 1 });
    t.fire('keydown', { code: 'KeyS' }); // W and S → forward 0
    expect(m.movement()).toEqual({ forward: 0, right: 1 });
    t.fire('keyup', { code: 'KeyD' });
    expect(m.movement()).toEqual({ forward: 0, right: 0 });
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- inputMapper`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/nav/InputMapper.ts`:
```ts
export class InputMapper {
  private down = false;
  private dx = 0; private dy = 0;
  private wheel = 0;
  private readonly keys = new Set<string>();

  private readonly onDown = () => { this.down = true; };
  private readonly onUp = () => { this.down = false; };
  private readonly onMove = (e: PointerEvent) => {
    if (this.down) { this.dx += e.movementX ?? 0; this.dy += e.movementY ?? 0; }
  };
  private readonly onWheel = (e: WheelEvent) => { this.wheel += e.deltaY ?? 0; };
  private readonly onKeyDown = (e: KeyboardEvent) => { this.keys.add(e.code); };
  private readonly onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };

  constructor(private readonly target: HTMLElement) {
    target.addEventListener('pointerdown', this.onDown as EventListener);
    target.addEventListener('pointerup', this.onUp as EventListener);
    target.addEventListener('pointercancel', this.onUp as EventListener);
    target.addEventListener('pointermove', this.onMove as EventListener);
    target.addEventListener('wheel', this.onWheel as EventListener);
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
  }

  consumeDrag(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy }; this.dx = 0; this.dy = 0; return d;
  }
  consumeWheel(): number { const w = this.wheel; this.wheel = 0; return w; }
  movement(): { forward: number; right: number } {
    return {
      forward: (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0),
      right: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
    };
  }
  dispose(): void {
    this.target.removeEventListener('pointerdown', this.onDown as EventListener);
    this.target.removeEventListener('pointerup', this.onUp as EventListener);
    this.target.removeEventListener('pointercancel', this.onUp as EventListener);
    this.target.removeEventListener('pointermove', this.onMove as EventListener);
    this.target.removeEventListener('wheel', this.onWheel as EventListener);
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- inputMapper`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/nav/InputMapper.ts tests/nav/inputMapper.test.ts
git -c commit.gpgsign=false commit -m "feat: add input mapper (drag, wheel, WASD)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 速度スライダー + 操作ヒント（DOM）

**Files:**
- Create: `src/ui/SpeedSlider.ts`, `src/ui/ControlHints.ts`
- Test: `tests/ui/speedSlider.test.ts`

**Interfaces:**
- Consumes: `speedFromSlider`/`formatSpeed`（Task 4）
- Produces:
  - `class SpeedSlider { constructor(root: HTMLElement); value(): number; setReadout(auPerSec: number, focusName: string): void }`（value は [0,1]、`<input type=range>` の現在値）
  - `class ControlHints { constructor(root: HTMLElement) }`（「ドラッグ=視点 / ホイール=ズーム / WASD=移動」を画面端に表示）

DOM の見た目は目視。単体テストは `value()` が range 入力値を返すこと・`setReadout` が日本語整形を書くことを jsdom で検証。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/speedSlider.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { SpeedSlider } from '../../src/ui/SpeedSlider';

describe('SpeedSlider', () => {
  it('reads the range input value in [0,1]', () => {
    const root = document.createElement('div');
    const s = new SpeedSlider(root);
    const input = root.querySelector('input[type=range]') as HTMLInputElement;
    input.value = '0.5';
    expect(s.value()).toBeCloseTo(0.5, 3);
  });
  it('writes a Japanese readout with speed and focus name', () => {
    const root = document.createElement('div');
    const s = new SpeedSlider(root);
    s.setReadout(2, '太陽');
    expect(root.textContent).toMatch(/AU\/秒/);
    expect(root.textContent).toMatch(/太陽/);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- speedSlider`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/ui/SpeedSlider.ts`:
```ts
import { formatSpeed } from '../nav/speed';

export class SpeedSlider {
  private readonly input: HTMLInputElement;
  private readonly readout: HTMLDivElement;

  constructor(root: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:min(420px,80vw);' +
      'color:#eaf2ff;font:13px system-ui,sans-serif;text-align:center;text-shadow:0 0 4px #000;';
    this.readout = document.createElement('div');
    this.readout.style.marginBottom = '6px';
    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.min = '0'; this.input.max = '1'; this.input.step = '0.001'; this.input.value = '0.25';
    this.input.style.width = '100%';
    wrap.append(this.readout, this.input);
    root.appendChild(wrap);
    this.setReadout(0, '—');
  }

  value(): number { return Number(this.input.value); }

  setReadout(auPerSec: number, focusName: string): void {
    this.readout.textContent = `速度: ${formatSpeed(auPerSec)}　｜　対象: ${focusName}`;
  }
}
```

`src/ui/ControlHints.ts`:
```ts
export class ControlHints {
  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;right:16px;bottom:16px;color:#9fb6d6;font:12px/1.6 system-ui,sans-serif;' +
      'text-align:right;text-shadow:0 0 4px #000;pointer-events:none;';
    el.innerHTML = 'ドラッグ: 視点<br>ホイール: ズーム<br>WASD: 移動<br>クリック: 選択';
    root.appendChild(el);
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- speedSlider`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/ui/SpeedSlider.ts src/ui/ControlHints.ts tests/ui/speedSlider.test.ts
git -c commit.gpgsign=false commit -m "feat: add speed slider and control hints UI" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: StarField フォーカス相対描画 + 土星の環

**Files:**
- Create: `src/nav/starRelative.ts`（純粋座標変換ヘルパー）
- Modify: `src/starfield/StarField.ts`, `src/starfield/starfield.vert.glsl`
- Modify: `src/system/SystemScene.ts`（`hasRing` 惑星に環）
- Test: `tests/nav/starRelative.test.ts`, `tests/starfield/starFieldFocus.test.ts`, `tests/system/systemSceneRing.test.ts`

**Interfaces:**
- Consumes: `StarColumns`, three
- Produces:
  - `starRelativeAu(posPc: [number,number,number], focusPc: [number,number,number], scaleAuPerPc: number, cameraAu: [number,number,number]): [number,number,number]`（`= (posPc - focusPc) * scale - cameraAu`。シェーダと同一式）
  - `StarField` に `setFocus(focusPc: [number,number,number], focusIndex: number): void`（uFocusPc 更新 + focusIndex の点を size 0 で隠し、前フォーカスを復元）, `updateCamera(cameraAu: [number,number,number]): void`（uCameraAu 更新）。定数 `AU_PER_PC = 206264.8`。
  - `SystemScene` は `hasRing:true` の惑星に環メッシュを追加（惑星スフィアの周囲、xz 面）。

- [ ] **Step 1: 失敗するテストを書く**

`tests/nav/starRelative.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { starRelativeAu } from '../../src/nav/starRelative';

describe('starRelativeAu', () => {
  it('is (posPc - focusPc) * scale - cameraAu', () => {
    const r = starRelativeAu([2, 0, 0], [1, 0, 0], 100, [10, 0, 0]);
    expect(r).toEqual([100 - 10, 0, 0]); // (2-1)*100 - 10 = 90
  });
  it('focus star at focus maps near camera origin offset', () => {
    const r = starRelativeAu([5, 5, 5], [5, 5, 5], 206264.8, [0, 0, 0]);
    expect(r).toEqual([0, 0, 0]);
  });
});
```

`tests/starfield/starFieldFocus.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StarField } from '../../src/starfield/StarField';

const columns = {
  count: 3,
  x: new Float32Array([0, 1, 2]), y: new Float32Array([0, 0, 0]), z: new Float32Array([0, 0, 0]),
  mag: new Float32Array([1, 2, 3]), absmag: new Float32Array([1, 1, 1]), ci: new Float32Array([0, 0, 0]),
};

describe('StarField.setFocus', () => {
  it('hides the focused star point and restores the previous one', () => {
    const f = new StarField(columns);
    const size = () => (f.object.geometry.getAttribute('size') as THREE.BufferAttribute).array as Float32Array;
    const before1 = size()[1];
    f.setFocus([1, 0, 0], 1);
    expect(size()[1]).toBe(0);
    f.setFocus([2, 0, 0], 2);
    expect(size()[1]).toBeCloseTo(before1!, 6); // restored
    expect(size()[2]).toBe(0);
  });
});
```

`tests/system/systemSceneRing.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SystemScene } from '../../src/system/SystemScene';
import type { StellarSystem } from '../../src/system/types';

function sys(hasRing: boolean): StellarSystem {
  return {
    starIndex: 0, starName: 'T', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
    planets: [{ name: 'p', type: 'gas', semiMajorAxisAu: 9, radiusEarth: 9, massEarth: 100, eqTempK: null, inHabitableZone: false, isReal: true, estimated: false, hasRing }],
  };
}

describe('SystemScene planet ring', () => {
  it('adds one extra mesh for a ringed planet', () => {
    const withRing = new SystemScene(sys(true));
    const without = new SystemScene(sys(false));
    const meshCount = (s: SystemScene) => s.root.children.filter((o) => o instanceof THREE.Mesh).length;
    expect(meshCount(withRing)).toBe(meshCount(without) + 1);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- starRelative starFieldFocus systemSceneRing`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/nav/starRelative.ts`:
```ts
export function starRelativeAu(
  posPc: [number, number, number],
  focusPc: [number, number, number],
  scaleAuPerPc: number,
  cameraAu: [number, number, number],
): [number, number, number] {
  return [
    (posPc[0] - focusPc[0]) * scaleAuPerPc - cameraAu[0],
    (posPc[1] - focusPc[1]) * scaleAuPerPc - cameraAu[1],
    (posPc[2] - focusPc[2]) * scaleAuPerPc - cameraAu[2],
  ];
}
```

`src/starfield/starfield.vert.glsl` を、フォーカス相対 + AU スケールに変更:
```glsl
uniform vec3 uFocusPc;
uniform float uScaleAuPerPc;
uniform vec3 uCameraAu;
uniform float uPixelScale;
attribute float size;
varying vec3 vColor;

void main() {
  vColor = color;
  vec3 rel = (position - uFocusPc) * uScaleAuPerPc - uCameraAu;
  vec4 mv = modelViewMatrix * vec4(rel, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uPixelScale / max(-mv.z, 0.001);
  gl_PointSize = clamp(gl_PointSize, 1.0, 24.0);
}
```

`src/starfield/StarField.ts` を改修（uniforms を差し替え、setFocus/updateCamera を追加、旧 `updateOrigin` は削除）:
- 定数 `export const AU_PER_PC = 206264.8;`
- ShaderMaterial の uniforms を `uFocusPc:{value:new THREE.Vector3()}, uScaleAuPerPc:{value:AU_PER_PC}, uCameraAu:{value:new THREE.Vector3()}, uPixelScale:{value:300}` に。
- `private focusIndex = -1;` と、元の size を復元するため geometry の size 属性を直接操作。
```ts
  setFocus(focusPc: [number, number, number], focusIndex: number): void {
    (this.material.uniforms.uFocusPc!.value as THREE.Vector3).set(focusPc[0], focusPc[1], focusPc[2]);
    const attr = this.object.geometry.getAttribute('size') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    if (this.focusIndex >= 0) arr[this.focusIndex] = this.savedSize; // restore previous
    if (focusIndex >= 0) { this.savedSize = arr[focusIndex]!; arr[focusIndex] = 0; }
    this.focusIndex = focusIndex;
    attr.needsUpdate = true;
  }
  updateCamera(cameraAu: [number, number, number]): void {
    (this.material.uniforms.uCameraAu!.value as THREE.Vector3).set(cameraAu[0], cameraAu[1], cameraAu[2]);
  }
```
（`private savedSize = 0;` を追加。material は `private` 保持に。）

`src/system/SystemScene.ts`: 惑星ループ内で `if (p.hasRing)` の場合、惑星スフィアの少し外側にリング（`THREE.RingGeometry(r*1.3, r*2.2, 48)` を xz 面へ回転、半透明 Basic マテリアル）を追加し `this.root.add(ring)`。`planetMeshes` には追加しない（選択対象は惑星本体のみ）。

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- starRelative starFieldFocus systemSceneRing`
Expected: PASS。`npm test` 全体も緑。`npx tsc --noEmit` クリーン。
（注: `starField.test.ts` の既存 `buildStarGeometry` テストは不変で通る。旧 `updateOrigin` を参照するテストがあれば setFocus/updateCamera 前提に更新。）

- [ ] **Step 5: コミット**

```bash
git add src/nav/starRelative.ts src/starfield/StarField.ts src/starfield/starfield.vert.glsl src/system/SystemScene.ts tests/nav/starRelative.test.ts tests/starfield/starFieldFocus.test.ts tests/system/systemSceneRing.test.ts
git -c commit.gpgsign=false commit -m "feat: focus-relative star field rendering and Saturn ring" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: app.ts 再構築（前半）— 単一シーン + 周回カメラ + 入力 + フェード

**Files:**
- Modify: `src/app.ts`（全面書き換え。galaxy/system モード分岐・ShipController・突入ボタンを撤去）
- （`src/flight/ShipController.ts` 等は当面残置。参照が消えるだけ）

**Interfaces:**
- Consumes: `Renderer`/`isWebGL2Available`, `FloatingOrigin`, `StarCatalog`, `StarField`（Task 8 改修版）, `AU_PER_PC`, `buildStellarSystem`, `SystemScene`, `loadExoplanets`, `NavigationController`（Task 5）, `orbitCameraPosition`（Task 3）, `systemFade`（Task 4）, `speedFromSlider`（Task 4）, `InputMapper`（Task 6）, `SpeedSlider`（Task 7）, `ControlHints`（Task 7）
- Produces: `startApp(root)`, `showFatal(root, msg)`（維持）

**座標モデル（厳守）:** scene 原点 = フォーカス点。`nav.focusWorldAu`（AU）が世界での位置、`focusWorldPc = focusWorldAu / AU_PER_PC`。カメラは `orbitCameraPosition([0,0,0], yaw, pitch, viewDistanceAu)` で原点を周回（AU 相対）。星野は `StarField.setFocus(focusWorldPc, focusIndex)` + `updateCamera(cameraAu)` で相対描画。フォーカス星の系（SystemScene）は原点付近に配置し `systemFade(viewDistanceAu)` で透明度制御。

**この Task の検証:** ハードゲートは `npm run build` 成功 + `npm test` 緑（app は単体テストなし）。描画・操作・フェードの目視はコントローラが Playwright で実施。

**受入基準（目視）:**
1. 起動時、太陽系を斜め上から見下ろし、太陽 + 8 惑星 + 軌道リングが見える。
2. ドラッグで視点が周回、ホイールでズームイン/アウト、WASD で移動。
3. ズームアウトすると太陽系がフェードアウトし、銀河の星野（他の星々）が主役になる。太陽はその一点に。
4. 画面下に速度スライダー + 現在速度 + 対象名、画面端に操作ヒント。

- [ ] **Step 1: app.ts を書き換える**

`src/app.ts` を次の構造で実装する（`showFatal` は既存のまま維持）:
- WebGL2 チェック → `Renderer`, `origin = new FloatingOrigin()`（カメラ AU 世界位置）, `nav = new NavigationController()`, `input = new InputMapper(engine.renderer.domElement)`, `slider = new SpeedSlider(root)`, `new ControlHints(root)`。
- `catalog = await StarCatalog.load(...)`（失敗時 `showFatal`）。`exoplanets = await loadExoplanets('/data/exoplanets.json')`。
- `field = new StarField(catalog.columns)`; `engine.scene.add(field.object)`。
- フォーカス星の系を組む関数 `let systemScene: SystemScene | null = null; function rebuildSystem(index: number) { if (systemScene) { engine.scene.remove(systemScene.root); systemScene.dispose(); } const sys = buildStellarSystem(catalog.columns, index, catalog.nameOf(index), exoplanets); systemScene = new SystemScene(sys); engine.scene.add(systemScene.root); return sys; }`。
- 起動: `nav.setFocus(0, [0,0,0])`; `let currentSystem = rebuildSystem(0);`。`field.setFocus([0,0,0], 0)`（太陽を隠す。太陽 = HYG index 0）。
- `const camAu = new THREE.Vector3();`。定数 `DRAG_SENS = 0.005`, `ZOOM_SENS = 0.0015`, `PIXEL_TO_STAR = 300`。
- frame ループ:
  - dt 計算。
  - 入力: `const drag = input.consumeDrag(); nav.orbit(-drag.dx*DRAG_SENS, -drag.dy*DRAG_SENS);`
    `const w = input.consumeWheel(); if (w) nav.zoom(Math.exp(w*ZOOM_SENS));`
    `const mv = input.movement(); nav.translate(mv.forward, mv.right, speedFromSlider(slider.value()), dt);`
  - カメラ: `const { position, target } = orbitCameraPosition([0,0,0], nav.orbitYaw, nav.orbitPitch, nav.viewDistanceAu); engine.camera.position.set(...position); engine.camera.lookAt(target[0],target[1],target[2]); camAu.set(...position);`
  - 星野: `const fp: [number,number,number] = [nav.focusWorldAu[0]/AU_PER_PC, nav.focusWorldAu[1]/AU_PER_PC, nav.focusWorldAu[2]/AU_PER_PC]; field.object.position.set(0,0,0);`（星野は自前で相対描画）`field.setFocus(fp, nav.focusStarIndex)`（フォーカス星の点を隠す。Task 10 で index 更新）; `field.updateCamera([camAu.x, camAu.y, camAu.z]);`
    ※ フォーカス点(=太陽)が原点なので、系は原点、星野もフォーカス相対で原点合わせ。
  - フェード: `const fade = systemFade(nav.viewDistanceAu);` を systemScene の全マテリアルの opacity に反映（`systemScene.root.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = fade; } })`、`fade===0` のとき `systemScene.root.visible=false`）。
  - `slider.setReadout(speedFromSlider(slider.value()), currentSystem.starName);`
  - `engine.render(); requestAnimationFrame(frame);`
- `index.html` の canvas がドラッグでテキスト選択されないよう `engine.renderer.domElement.style.touchAction='none'` を設定。ポインタロックは使わない（ドラッグ操作のため）。

（注: 惑星シェーダー等の一部マテリアルは `transparent/opacity` で素直にフェードする。恒星球 Basic・リング Basic も同様。フェードの見え方はコントローラが調整。）

- [ ] **Step 2: 型チェック / ビルド / テスト**

Run: `npx tsc --noEmit` → クリーン。`npm run build`（監査 hook 時 `# CLAUDE_AUDIT_OK`）→ 成功。`npm test` → 全緑（既存 + 新規、app は単体なし）。

- [ ] **Step 3: コミット**

```bash
git add src/app.ts
git -c commit.gpgsign=false commit -m "feat: rebuild app as unified zoom navigation (Solar System start)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: app.ts 再構築（後半）— フォーカス切替 + クリック選択

**Files:**
- Modify: `src/app.ts`
- Create: `src/nav/nearestStar.ts`（フォーカス点に最も近いカタログ星を返す純粋関数）
- Test: `tests/nav/nearestStar.test.ts`

**Interfaces:**
- Consumes: `StarColumns`, `pickStar`（Picker）, `pickPlanet`（planetPick）, `describeStar`, `describePlanet`（PlanetPanel）, `InfoPanel`, `PlanetPanel`, `starRelativeAu`（Task 8）
- Produces: `nearestStarPc(focusPc: [number,number,number], columns: StarColumns): { index: number; distPc: number }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/nav/nearestStar.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { nearestStarPc } from '../../src/nav/nearestStar';

const columns = {
  count: 3,
  x: new Float32Array([0, 10, 3]), y: new Float32Array([0, 0, 0]), z: new Float32Array([0, 0, 0]),
  mag: new Float32Array([1, 1, 1]), absmag: new Float32Array([1, 1, 1]), ci: new Float32Array([0, 0, 0]),
};

describe('nearestStarPc', () => {
  it('returns the closest star index and its distance', () => {
    const r = nearestStarPc([2.9, 0, 0], columns);
    expect(r.index).toBe(2); // star at x=3 is closest to 2.9
    expect(r.distPc).toBeCloseTo(0.1, 5);
  });
  it('returns index 0 (Sun) at the origin', () => {
    expect(nearestStarPc([0, 0, 0], columns).index).toBe(0);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- nearestStar`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/nav/nearestStar.ts`:
```ts
import type { StarColumns } from '../catalog/format';

export function nearestStarPc(
  focusPc: [number, number, number],
  columns: StarColumns,
): { index: number; distPc: number } {
  let best = 0, bestD2 = Infinity;
  for (let i = 0; i < columns.count; i++) {
    const dx = columns.x[i]! - focusPc[0], dy = columns.y[i]! - focusPc[1], dz = columns.z[i]! - focusPc[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  return { index: best, distPc: Math.sqrt(bestD2) };
}
```

- [ ] **Step 4: app.ts にフォーカス切替とクリック選択を結線**

- `InfoPanel`/`PlanetPanel` を生成。
- フレーム毎（or 移動時）にフォーカス切替:
  ```ts
  const fpPc = [nav.focusWorldAu[0]/AU_PER_PC, nav.focusWorldAu[1]/AU_PER_PC, nav.focusWorldAu[2]/AU_PER_PC];
  const near = nearestStarPc(fpPc, catalog.columns);
  if (near.index !== nav.focusStarIndex) {
    nav.focusStarIndex = near.index;
    currentSystem = rebuildSystem(near.index);
  }
  ```
  （系は「フォーカスに最も近い星」の系を常に表示。太陽から離れて別の星に近づくとその系に切替わる。SystemScene は原点基準だが、厳密には星の実位置オフセットに置くのが理想 — ただし本 UX ではフォーカス点＝注視点なので原点表示で可。ズームアウト時は fade で見えないため問題にならない。）
- クリック選択（ドラッグと区別: pointerdown→pointerup 間の移動量が小さいときのみ選択）:
  - カメラから注視方向へレイ。`fade > 0.5`（系が見える）なら `pickPlanet` を試し、当たれば `planetPanel.show`。外れ or 系が見えない（銀河ビュー）なら `pickStar` で星選択 → `infoPanel.show(describeStar(...))`。
  - ドラッグ判定: `InputMapper` に「pointerdown からの累積移動量が閾値未満なら click」を判定するため、pointerdown 位置と up 位置を比較する小さなクリック検出を app 側に持つ（`renderer.domElement` に pointerdown/up を別途張り、移動量 < 5px なら選択処理）。
- 速度スライダーの対象名は `currentSystem.starName`。

**受入基準（目視・コントローラ）:** WASD で銀河を飛び、別の星に近づくとその星系が現れる（フォーカス切替）。クリックで星/惑星を選択し日本語情報が出る。ドラッグ操作は選択を誤発火しない。

- [ ] **Step 5: テスト / ビルド確認**

Run: `npm test -- nearestStar` → PASS。`npm test` 全緑。`npx tsc --noEmit` クリーン。`npm run build` 成功（`# CLAUDE_AUDIT_OK`）。

- [ ] **Step 6: コミット**

```bash
git add src/app.ts src/nav/nearestStar.ts tests/nav/nearestStar.test.ts
git -c commit.gpgsign=false commit -m "feat: add focus switching and click selection to navigation" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review（計画作成者による点検結果）

**1. Spec coverage:**
- マウスドラッグ+ホイール+WASD+速度スライダー操作: Task 5, 6, 7, 9 ✓
- 太陽系見下ろし開始（本物 8 惑星）: Task 1, 2, 9 ✓
- ズームで銀河へ連続遷移（フェード）: Task 4, 8, 9 ✓
- 単一 AU ワールド + floating origin + 対数深度 + フォーカス相対: Task 8, 9 ✓
- フォーカス切替（他星系へ）: Task 10 ✓
- クリック選択 + 情報パネル + 操作ヒント: Task 7, 10 ✓
- 土星の環: Task 8 ✓
- HUD（速度・対象名）: Task 7, 9 ✓
- テスト（カメラ・フェード・航法・太陽系・速度・最近傍）: Task 1,3,4,5,6,7,8,10 ✓

**2. Placeholder scan:** 純粋モジュールは完全コード。描画/結線（8,9,10）は精密手順 + コード断片 + 受入基準 + コントローラ目視（M1 Task 12 / M2a Task 6 と同方式）。TBD/TODO なし。

**3. Type consistency:**
- `NavigationController`（focusStarIndex/focusWorldAu/orbit/zoom/translate/setFocus）は Task 5 定義を Task 9/10 が使用、一致。
- `orbitCameraPosition(focus,yaw,pitch,distance)→{position,target}` は Task 3 定義を Task 9 が使用、一致。
- `systemFade`/`speedFromSlider`/`formatSpeed` は Task 4 定義を Task 7/9 が使用、一致。
- `StarField.setFocus/updateCamera` + `AU_PER_PC` は Task 8 定義を Task 9 が使用、一致。
- `Planet.hasRing?` は Task 1 定義を Task 8（SystemScene 環）が使用、一致。
- `nearestStarPc` は Task 10 定義、app が使用。
- `getSolarSystem` は Task 1 → Task 2 が使用、一致。

**4. 回帰リスク:** app.ts の全面書き換えで M2a の突入体験を置換する。惑星描画・選択・NASA 実在データ・太陽系表示・銀河遷移をコントローラが Playwright で実データ再確認。旧 `ShipController`/`InfoPanel の突入ボタン`等は当面残置（未参照）で、最終レビューで整理判断。

---

## 実行方式

**Subagent-Driven** 推奨。純粋モジュール（Task 1〜8 の計算部）は完全コード転記 + TDD で標準〜cheap モデル、app.ts 再構築（Task 9,10）は wiring 判断のため標準モデル、最終レビューは最上位モデル。各描画タスク後にコントローラが実データ + Playwright でエンドツーエンド検証（太陽系開始・ドラッグ/ズーム/WASD・銀河遷移・フォーカス切替・クリック選択）。


