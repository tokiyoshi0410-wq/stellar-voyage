# stellar-voyage M2a（恒星系突入と惑星）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** M1 で選択した実在星に「突入」し、AU 単位のローカル座標系でその恒星系の惑星群（実在 NASA データ or 手続き生成）を 3D 表示し、型別 GLSL シェーダーで惑星クローズアップを見られるようにする。

**Architecture:** M1 の galaxy ビューに system ビューを追加し、`AppMode = 'galaxy' | 'system'` で切替える。恒星系モデルは pure モジュール（`system/`）で決定論生成し、実在データがあれば優先。描画は `SystemScene`（恒星スフィア + 惑星スフィア + 軌道リング）+ 型別 `PlanetMaterial`（GLSL）。M1 の Renderer/ShipController/InputController/Picker を system ビューでも流用する。

**Tech Stack:** TypeScript 5.9、Three.js（既存）、Vite 7、vitest 3、tsx（ビルド時 NASA データ結合）。追加ランタイム依存なし。

## Global Constraints

- パッケージマネージャ npm、`"type": "module"`。ランタイム依存は Three.js のみ（NASA 結合は build 専用 `tsx`）。
- 全ユーザー向け文言は**日本語**。
- 座標系: galaxy ビューはパーセク（M1 のまま）、system ビューは **AU**。
- 手続き生成は**決定論的**（シード = 星のカタログ index）。同じ星に再突入すれば必ず同じ系。
- TS strict + `noUncheckedIndexedAccess` ON（Float32Array/配列添字は `!` を付ける、M1 の慣習に従う）。
- テストは vitest。純粋ロジック（生成・判定・変換・結合）を単体テストし、描画は Playwright 目視（コントローラが実施）。
- NASA Exoplanet Archive は自由利用可、出典を About/README に記載。HYG の CC BY-SA 4.0 クレジットは維持。
- コミットはタスク単位。メッセージ末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。署名エラー時は `git -c commit.gpgsign=false commit`、`--no-verify` は使わない。
- ビルド系コマンド（`npm run build`/`build:catalog`/`build:exoplanets`）は監査 hook が発火する場合がある。変更が test 済み・隔離されていれば末尾に `# CLAUDE_AUDIT_OK` を付けて再実行してよい。

## 既存 M1 モジュール（このプランが依存する実シグネチャ）

- `catalog/format.ts`: `interface StarColumns { count; x/y/z/mag/absmag/ci: Float32Array }`, `encodeCatalog`, `decodeCatalog`
- `catalog/StarCatalog.ts`: `class StarCatalog { columns: StarColumns; names: Record<number,string>; static load; static fromData; nameOf(index): string | null }`
- `astro/color.ts`: `bvToTemperature(bv): number`
- `astro/spectral.ts`: `temperatureToSpectralClass(kelvin): SpectralClass`, `absMagToLuminosity(absmag): number`, `PARSEC_IN_LY`
- `engine/Renderer.ts`: `class Renderer { scene; camera; renderer; resize; render(); dispose() }`, `isWebGL2Available`
- `engine/FloatingOrigin.ts`: `class FloatingOrigin { position:[number,number,number]; setPosition; translate; relative }`
- `flight/ShipController.ts`: `class ShipController { throttle; orientation: THREE.Quaternion; constructor(origin); speedC; isWarp; update(dt) }`
- `flight/InputController.ts`: `class InputController { constructor(target); applyThrottle(current,dt); consumePointerDelta(); dispose() }`
- `selection/Picker.ts`: `pickStar(cameraPos, rayDir, columns, maxAngleRad): number | null`
- `ui/InfoPanel.ts`: `class InfoPanel { constructor(root); show(info: StarInfo); hide() }`
- `ui/format.ts`: `describeStar(columns, index, name): StarInfo`
- `scripts/build-catalog.ts`: `parseHygCsv(text): { columns: StarColumns; names: Record<number,string> }`, `parseCsvLine(line): string[]`
- `app.ts`: `startApp(root)`, `showFatal(root, message)`

## File Structure

```
src/
  system/
    types.ts            # PlanetType, Planet, StellarSystem 型
    habitableZone.ts    # habitableZone(L), inHabitableZone(a, L)
    rng.ts              # mulberry32 決定論 PRNG
    planetGen.ts        # snowLineAu, classifyPlanetType, generatePlanets
    StellarSystem.ts    # buildStellarSystem(columns, index, name, exoplanets?)
    orbit.ts            # orbitPosition(a, phase), planetPhase(starIndex, planetIndex)
    SystemScene.ts      # planetTypeColor, class SystemScene（恒星+惑星+リング）
  planets/
    PlanetMaterial.ts   # makePlanetMaterial(type, seed): THREE.ShaderMaterial
    planet.vert.glsl
    planet.frag.glsl
  catalog/
    exoplanets.ts       # loadExoplanets(url): Promise<Record<number, Planet[]>>
  ui/
    PlanetPanel.ts      # 惑星情報パネル（日本語）
    SystemHud.ts        # 系内 HUD（恒星名・選択惑星・「系を出る」）
  app.ts (変更)         # AppMode 分岐、突入/退出、InfoPanel 突入ボタン結線
scripts/
  build-exoplanets.ts   # NASA データを HYG 星 index に結合し exoplanets.json 生成
tests/
  system/*.test.ts, catalog/exoplanets.test.ts, scripts/... 各テスト
```

M1 の `app.ts` を galaxy/system の 2 モードに再構成する。M1 の galaxy 挙動は忠実に温存し、
system モードを追加する形にする（M1 回帰はコントローラが Playwright で再確認）。

---

### Task 1: 惑星型 + ハビタブルゾーン（純粋）

**Files:**
- Create: `src/system/types.ts`, `src/system/habitableZone.ts`
- Test: `tests/system/habitableZone.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `type PlanetType = 'rock' | 'ocean' | 'gas' | 'ice'`
  - `interface Planet { name: string; type: PlanetType; semiMajorAxisAu: number; radiusEarth: number; massEarth: number; eqTempK: number | null; inHabitableZone: boolean; isReal: boolean; estimated: boolean }`
  - `interface StellarSystem { starIndex: number; starName: string; spectralClass: string; temperatureK: number; luminositySun: number; planets: Planet[] }`
  - `habitableZone(luminositySun: number): { inner: number; outer: number }`
  - `inHabitableZone(semiMajorAxisAu: number, luminositySun: number): boolean`

- [ ] **Step 1: 失敗するテストを書く**

`tests/system/habitableZone.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { habitableZone, inHabitableZone } from '../../src/system/habitableZone';

describe('habitableZone', () => {
  it('sun (L=1) is roughly 0.95..1.37 AU', () => {
    const hz = habitableZone(1);
    expect(hz.inner).toBeCloseTo(0.953, 2);
    expect(hz.outer).toBeCloseTo(1.374, 2);
  });

  it('brighter star has a farther zone', () => {
    expect(habitableZone(4).inner).toBeGreaterThan(habitableZone(1).inner);
  });

  it('inHabitableZone flags orbits inside the band', () => {
    expect(inHabitableZone(1.0, 1)).toBe(true);
    expect(inHabitableZone(0.2, 1)).toBe(false);
    expect(inHabitableZone(5.0, 1)).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- habitableZone`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 実装**

`src/system/types.ts`:
```ts
export type PlanetType = 'rock' | 'ocean' | 'gas' | 'ice';

export interface Planet {
  name: string;
  type: PlanetType;
  semiMajorAxisAu: number;
  radiusEarth: number;
  massEarth: number;
  eqTempK: number | null;
  inHabitableZone: boolean;
  isReal: boolean;
  estimated: boolean;
}

export interface StellarSystem {
  starIndex: number;
  starName: string;
  spectralClass: string;
  temperatureK: number;
  luminositySun: number;
  planets: Planet[];
}
```

`src/system/habitableZone.ts`:
```ts
export function habitableZone(luminositySun: number): { inner: number; outer: number } {
  return {
    inner: Math.sqrt(luminositySun / 1.1),
    outer: Math.sqrt(luminositySun / 0.53),
  };
}

export function inHabitableZone(semiMajorAxisAu: number, luminositySun: number): boolean {
  const { inner, outer } = habitableZone(luminositySun);
  return semiMajorAxisAu >= inner && semiMajorAxisAu <= outer;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- habitableZone`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/system/types.ts src/system/habitableZone.ts tests/system/habitableZone.test.ts
git -c commit.gpgsign=false commit -m "feat: add planet types and habitable-zone calculation" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 決定論 PRNG + 手続き惑星生成（純粋）

**Files:**
- Create: `src/system/rng.ts`, `src/system/planetGen.ts`
- Test: `tests/system/rng.test.ts`, `tests/system/planetGen.test.ts`

**Interfaces:**
- Consumes: `mulberry32`（rng）, `inHabitableZone`（Task 1）, `Planet`/`PlanetType`（Task 1）
- Produces:
  - rng: `mulberry32(seed: number): () => number`（[0,1) を返す関数）
  - planetGen: `snowLineAu(luminositySun: number): number`,
    `classifyPlanetType(semiMajorAxisAu: number, luminositySun: number, rand: number): PlanetType`,
    `generatePlanets(starIndex: number, spectralClass: string, luminositySun: number): Planet[]`

- [ ] **Step 1: 失敗するテストを書く**

`tests/system/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { mulberry32 } from '../../src/system/rng';

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(123); const b = mulberry32(123);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('returns values in [0,1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 100; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
  it('different seeds diverge', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });
});
```

`tests/system/planetGen.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { snowLineAu, classifyPlanetType, generatePlanets } from '../../src/system/planetGen';

describe('classifyPlanetType', () => {
  it('outside the snow line is gas or ice', () => {
    const snow = snowLineAu(1); // ~2.7 AU
    expect(['gas', 'ice']).toContain(classifyPlanetType(snow + 1, 1, 0.2));
    expect(['gas', 'ice']).toContain(classifyPlanetType(snow + 1, 1, 0.8));
  });
  it('inside the snow line is rock or ocean', () => {
    expect(['rock', 'ocean']).toContain(classifyPlanetType(1.0, 1, 0.2));
    expect(['rock', 'ocean']).toContain(classifyPlanetType(0.3, 1, 0.9));
  });
});

describe('generatePlanets', () => {
  it('is deterministic for a given star index', () => {
    const a = generatePlanets(42, 'G', 1);
    const b = generatePlanets(42, 'G', 1);
    expect(a).toEqual(b);
  });
  it('different indices give different systems (usually)', () => {
    const a = generatePlanets(1, 'G', 1);
    const b = generatePlanets(2, 'G', 1);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
  it('planets have valid fields and increasing orbits', () => {
    const ps = generatePlanets(99, 'K', 0.4);
    let prev = 0;
    for (const p of ps) {
      expect(p.semiMajorAxisAu).toBeGreaterThan(prev); prev = p.semiMajorAxisAu;
      expect(p.radiusEarth).toBeGreaterThan(0);
      expect(p.massEarth).toBeGreaterThan(0);
      expect(['rock', 'ocean', 'gas', 'ice']).toContain(p.type);
      expect(p.isReal).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- rng planetGen`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/system/rng.ts`:
```ts
// mulberry32 — 小さな決定論 PRNG。[0,1) を返す関数を生成する。
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function (): number {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

`src/system/planetGen.ts`:
```ts
import { mulberry32 } from './rng';
import { inHabitableZone } from './habitableZone';
import type { Planet, PlanetType } from './types';

// 雪線（凍結線）: おおよそ 2.7 * sqrt(L) AU
export function snowLineAu(luminositySun: number): number {
  return 2.7 * Math.sqrt(luminositySun);
}

export function classifyPlanetType(
  semiMajorAxisAu: number, luminositySun: number, rand: number,
): PlanetType {
  if (semiMajorAxisAu >= snowLineAu(luminositySun)) {
    return rand < 0.5 ? 'gas' : 'ice';
  }
  return inHabitableZone(semiMajorAxisAu, luminositySun) && rand < 0.6 ? 'ocean' : 'rock';
}

const RADIUS_RANGE: Record<PlanetType, [number, number]> = {
  rock: [0.4, 1.6], ocean: [0.8, 2.5], ice: [1.0, 4.0], gas: [4.0, 12.0],
};
const DENSITY: Record<PlanetType, number> = { rock: 1.0, ocean: 0.7, ice: 0.4, gas: 0.2 };

function planetCount(spectralClass: string, rand: () => number): number {
  const base = 'OB'.includes(spectralClass) ? 3 : 'AF'.includes(spectralClass) ? 5 : 7;
  return Math.floor(rand() * base); // 0..base-1
}

export function generatePlanets(
  starIndex: number, spectralClass: string, luminositySun: number,
): Planet[] {
  const rand = mulberry32((starIndex * 2654435761) >>> 0);
  const n = planetCount(spectralClass, rand);
  const planets: Planet[] = [];
  let a = 0.2 + rand() * 0.3;
  for (let i = 0; i < n; i++) {
    a *= 1.4 + rand() * 1.2;
    const type = classifyPlanetType(a, luminositySun, rand());
    const [rmin, rmax] = RADIUS_RANGE[type];
    const radiusEarth = rmin + rand() * (rmax - rmin);
    const massEarth = DENSITY[type] * Math.pow(radiusEarth, 3);
    planets.push({
      name: `${i + 1}番惑星`,
      type,
      semiMajorAxisAu: a,
      radiusEarth,
      massEarth,
      eqTempK: null,
      inHabitableZone: inHabitableZone(a, luminositySun),
      isReal: false,
      estimated: false,
    });
  }
  return planets;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- rng planetGen`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/system/rng.ts src/system/planetGen.ts tests/system/rng.test.ts tests/system/planetGen.test.ts
git -c commit.gpgsign=false commit -m "feat: add deterministic PRNG and procedural planet generation" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: StellarSystem ビルダー（純粋）

**Files:**
- Create: `src/system/StellarSystem.ts`
- Test: `tests/system/stellarSystem.test.ts`

**Interfaces:**
- Consumes: `StarColumns`（catalog/format）, `bvToTemperature`（astro/color）, `temperatureToSpectralClass`/`absMagToLuminosity`（astro/spectral）, `generatePlanets`（Task 2）, `Planet`/`StellarSystem`（Task 1）
- Produces:
  - `buildStellarSystem(columns: StarColumns, index: number, name: string | null, exoplanets?: Record<number, Planet[]>): StellarSystem`
  - 実在データ（`exoplanets[index]` が非空）があれば優先、無ければ `generatePlanets`。

- [ ] **Step 1: 失敗するテストを書く**

`tests/system/stellarSystem.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildStellarSystem } from '../../src/system/StellarSystem';
import type { Planet } from '../../src/system/types';

const columns = {
  count: 1,
  x: new Float32Array([2]), y: new Float32Array([0]), z: new Float32Array([0]),
  mag: new Float32Array([1]), absmag: new Float32Array([4.83]), ci: new Float32Array([0.63]),
};

describe('buildStellarSystem', () => {
  it('computes star fields and a procedural system when no real data', () => {
    const sys = buildStellarSystem(columns, 0, 'Sol');
    expect(sys.starName).toBe('Sol');
    expect(sys.luminositySun).toBeCloseTo(1, 2);
    expect(['O','B','A','F','G','K','M']).toContain(sys.spectralClass);
    expect(Array.isArray(sys.planets)).toBe(true);
  });
  it('falls back to HYG index when unnamed', () => {
    expect(buildStellarSystem(columns, 0, null).starName).toBe('HYG #0');
  });
  it('prefers real exoplanet data when present', () => {
    const real: Planet[] = [{
      name: 'Sol b', type: 'gas', semiMajorAxisAu: 5, radiusEarth: 11, massEarth: 300,
      eqTempK: 120, inHabitableZone: false, isReal: true, estimated: false,
    }];
    const sys = buildStellarSystem(columns, 0, 'Sol', { 0: real });
    expect(sys.planets).toEqual(real);
    expect(sys.planets[0]!.isReal).toBe(true);
  });
  it('is deterministic for the procedural path', () => {
    expect(buildStellarSystem(columns, 0, 'Sol')).toEqual(buildStellarSystem(columns, 0, 'Sol'));
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- stellarSystem`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/system/StellarSystem.ts`:
```ts
import type { StarColumns } from '../catalog/format';
import { bvToTemperature } from '../astro/color';
import { temperatureToSpectralClass, absMagToLuminosity } from '../astro/spectral';
import { generatePlanets } from './planetGen';
import type { Planet, StellarSystem } from './types';

export function buildStellarSystem(
  columns: StarColumns,
  index: number,
  name: string | null,
  exoplanets?: Record<number, Planet[]>,
): StellarSystem {
  const temperatureK = bvToTemperature(columns.ci[index]!);
  const spectralClass = temperatureToSpectralClass(temperatureK);
  const luminositySun = absMagToLuminosity(columns.absmag[index]!);
  const real = exoplanets?.[index];
  const planets = real && real.length > 0
    ? real
    : generatePlanets(index, spectralClass, luminositySun);
  return {
    starIndex: index,
    starName: name ?? `HYG #${index}`,
    spectralClass,
    temperatureK: Math.round(temperatureK),
    luminositySun,
    planets,
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- stellarSystem`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/system/StellarSystem.ts tests/system/stellarSystem.test.ts
git -c commit.gpgsign=false commit -m "feat: add stellar system builder (real data or procedural)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 軌道ジオメトリ（純粋）

**Files:**
- Create: `src/system/orbit.ts`
- Test: `tests/system/orbit.test.ts`

**Interfaces:**
- Consumes: `mulberry32`（Task 2）
- Produces:
  - `orbitPosition(semiMajorAxisAu: number, phaseRad: number): [number, number, number]`（黄道面 = xz 平面: `[a·cos, 0, a·sin]`）
  - `planetPhase(starIndex: number, planetIndex: number): number`（決定論的な固定位相 [0, 2π)）

- [ ] **Step 1: 失敗するテストを書く**

`tests/system/orbit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { orbitPosition, planetPhase } from '../../src/system/orbit';

describe('orbitPosition', () => {
  it('places at radius a in the xz plane', () => {
    const [x, y, z] = orbitPosition(3, 0);
    expect(x).toBeCloseTo(3, 6); expect(y).toBe(0); expect(z).toBeCloseTo(0, 6);
    const p = orbitPosition(2, Math.PI / 2);
    expect(p[0]).toBeCloseTo(0, 6); expect(p[2]).toBeCloseTo(2, 6);
  });
  it('distance from origin equals a', () => {
    const [x, y, z] = orbitPosition(4.2, 1.1);
    expect(Math.hypot(x, y, z)).toBeCloseTo(4.2, 6);
  });
});

describe('planetPhase', () => {
  it('is deterministic and in [0, 2π)', () => {
    const a = planetPhase(10, 2); const b = planetPhase(10, 2);
    expect(a).toBe(b); expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThan(Math.PI * 2);
  });
  it('varies by planet index', () => {
    expect(planetPhase(10, 0)).not.toBe(planetPhase(10, 1));
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- orbit`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/system/orbit.ts`:
```ts
import { mulberry32 } from './rng';

export function orbitPosition(semiMajorAxisAu: number, phaseRad: number): [number, number, number] {
  return [
    semiMajorAxisAu * Math.cos(phaseRad),
    0,
    semiMajorAxisAu * Math.sin(phaseRad),
  ];
}

export function planetPhase(starIndex: number, planetIndex: number): number {
  const rand = mulberry32(((starIndex * 73856093) ^ (planetIndex * 19349663)) >>> 0);
  return rand() * Math.PI * 2;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- orbit`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/system/orbit.ts tests/system/orbit.test.ts
git -c commit.gpgsign=false commit -m "feat: add orbit position and deterministic planet phase" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: SystemScene（恒星 + 惑星スフィア + 軌道リング）

**Files:**
- Create: `src/system/SystemScene.ts`
- Test: `tests/system/systemScene.test.ts`

**Interfaces:**
- Consumes: `StellarSystem`/`PlanetType`（Task 1）, `orbitPosition`/`planetPhase`（Task 4）, three
- Produces:
  - `planetTypeColor(type: PlanetType): number`
  - `class SystemScene { root: THREE.Group; planetMeshes: THREE.Mesh[]; constructor(system: StellarSystem); dispose(): void }`
  - `root` に恒星スフィア 1・PointLight 1・各惑星に（スフィア 1 + 軌道リング 1）を持つ。
    各惑星メッシュは `userData.planetIndex` を持つ（Picker/選択で使用）。

three のオブジェクト構築は WebGL 不要（jsdom で可）なので、構造を単体テストできる。

- [ ] **Step 1: 失敗するテストを書く**

`tests/system/systemScene.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SystemScene, planetTypeColor } from '../../src/system/SystemScene';
import type { StellarSystem } from '../../src/system/types';

const system: StellarSystem = {
  starIndex: 0, starName: 'Test', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
  planets: [
    { name: '1番惑星', type: 'rock', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1, eqTempK: null, inHabitableZone: true, isReal: false, estimated: false },
    { name: '2番惑星', type: 'gas', semiMajorAxisAu: 5, radiusEarth: 11, massEarth: 300, eqTempK: null, inHabitableZone: false, isReal: false, estimated: false },
  ],
};

describe('planetTypeColor', () => {
  it('gives a distinct color per type', () => {
    const colors = new Set(['rock','ocean','gas','ice'].map((t) => planetTypeColor(t as any)));
    expect(colors.size).toBe(4);
  });
});

describe('SystemScene', () => {
  it('builds star + light + one sphere and one ring per planet', () => {
    const scene = new SystemScene(system);
    expect(scene.planetMeshes.length).toBe(2);
    const meshes = scene.root.children.filter((o) => o instanceof THREE.Mesh);
    // 恒星(1) + 惑星(2) + リング(2) = 5 メッシュ
    expect(meshes.length).toBe(5);
    expect(scene.root.children.some((o) => o instanceof THREE.PointLight)).toBe(true);
  });
  it('tags planet meshes with their index', () => {
    const scene = new SystemScene(system);
    expect(scene.planetMeshes[0]!.userData.planetIndex).toBe(0);
    expect(scene.planetMeshes[1]!.userData.planetIndex).toBe(1);
  });
  it('places planet 0 at radius ~1 AU from origin', () => {
    const scene = new SystemScene(system);
    expect(scene.planetMeshes[0]!.position.length()).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- systemScene`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/system/SystemScene.ts`:
```ts
import * as THREE from 'three';
import type { StellarSystem, PlanetType } from './types';
import { orbitPosition, planetPhase } from './orbit';

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

  constructor(readonly system: StellarSystem) {
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc }),
    );
    this.root.add(star);

    system.planets.forEach((p, i) => {
      const [x, y, z] = orbitPosition(p.semiMajorAxisAu, planetPhase(system.starIndex, i));
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(planetDisplayRadius(p.radiusEarth), 24, 16),
        new THREE.MeshStandardMaterial({ color: planetTypeColor(p.type) }),
      );
      mesh.position.set(x, y, z);
      mesh.userData.planetIndex = i;
      this.planetMeshes.push(mesh);
      this.root.add(mesh);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(p.semiMajorAxisAu - 0.004, p.semiMajorAxisAu + 0.004, 128),
        new THREE.MeshBasicMaterial({ color: 0x2b4a7a, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.root.add(ring);
    });

    this.root.add(new THREE.PointLight(0xffffff, 2, 0, 0));
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- systemScene`
Expected: PASS。`npm test`（全体）も緑。`npx tsc --noEmit` クリーン。

- [ ] **Step 5: コミット**

```bash
git add src/system/SystemScene.ts tests/system/systemScene.test.ts
git -c commit.gpgsign=false commit -m "feat: add system scene with star, planet spheres, orbit rings" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: AppMode 分岐 + 突入/退出遷移 + 突入ボタン + SystemHud

**Files:**
- Modify: `src/app.ts`（メインループを mode 分岐に再構成）
- Modify: `src/ui/InfoPanel.ts`（「この星系へ」ボタン + onEnterSystem コールバック追加）
- Create: `src/ui/SystemHud.ts`（恒星名 + 「系を出る」ボタン + onExit コールバック）

**Interfaces:**
- Consumes: 全 M1 モジュール, `buildStellarSystem`（Task 3）, `SystemScene`（Task 5）, `StarCatalog`
- Produces:
  - `InfoPanel.show(info, onEnterSystem?: () => void)` — ボタン押下で `onEnterSystem` 呼出（未指定ならボタン非表示）
  - `class SystemHud { constructor(root); show(starName: string, onExit: () => void): void; hide(): void; setTarget(name: string | null): void }`
  - app.ts: `AppMode = 'galaxy' | 'system'`。突入時に galaxy のカメラ位置/向きを退避、退出時に復元。

**この Task の検証（M1 の Task 12 と同様）:** ハードゲートは `npm run build`（tsc + vite build）成功と `npm test` 緑。描画・遷移の目視はコントローラが Playwright で実施（下記受入基準）。

**受入基準（目視）:**
1. galaxy ビュー（M1）は従来どおり動作（回帰なし: 星野・飛行・ワープ・星選択）。
2. 星をクリック → InfoPanel に「この星系へ」ボタンが出る。
3. ボタン押下 → 恒星スフィア + 惑星 + 軌道リングの system ビューへ切替。
4. SystemHud に恒星名と「系を出る」ボタンが出る。
5. 「系を出る」→ galaxy ビューの元の位置・向きに復帰。

- [ ] **Step 1: InfoPanel に突入ボタンを追加**

`src/ui/InfoPanel.ts` の `show` を、任意の `onEnterSystem` コールバックを受け取り、
指定時のみ「この星系へ」ボタンを描画するよう変更する。既存の情報表示部は温存し、
末尾にボタンを追加。ボタンは `textContent`（XSS 回避）で日本語ラベル、クリックで
`onEnterSystem()` を呼ぶ。`onEnterSystem` 未指定時はボタンを出さない（M1 互換）。

実装指針（InfoPanel.show 内、既存 innerHTML 生成の後にボタン要素を append）:
```ts
show(info: StarInfo, onEnterSystem?: () => void): void {
  // ...既存の innerHTML 生成...
  this.el.style.display = 'block';
  if (onEnterSystem) {
    const btn = document.createElement('button');
    btn.textContent = 'この星系へ';
    btn.style.cssText = 'margin-top:10px;width:100%;padding:6px;cursor:pointer;' +
      'background:#1c3a63;color:#eaf2ff;border:1px solid #3a6ea5;border-radius:6px;font:13px system-ui;';
    btn.onclick = onEnterSystem;
    this.el.appendChild(btn);
  }
}
```
（`innerHTML = ...` でパネルを組み立てている場合、ボタンを append する前に innerHTML 設定を済ませること。append 後に innerHTML を再代入するとボタンが消えるので順序に注意。）

- [ ] **Step 2: SystemHud を実装**

`src/ui/SystemHud.ts`:
```ts
export class SystemHud {
  private readonly el: HTMLDivElement;
  private readonly starEl: HTMLDivElement;
  private readonly targetEl: HTMLDivElement;
  private readonly exitBtn: HTMLButtonElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;left:16px;top:16px;color:#eaf2ff;font:14px/1.6 system-ui,sans-serif;' +
      'text-shadow:0 0 4px #000;display:none;';
    this.starEl = document.createElement('div');
    this.targetEl = document.createElement('div');
    this.exitBtn = document.createElement('button');
    this.exitBtn.textContent = '系を出る';
    this.exitBtn.style.cssText = 'margin-top:8px;padding:6px 12px;cursor:pointer;' +
      'background:#1c3a63;color:#eaf2ff;border:1px solid #3a6ea5;border-radius:6px;font:13px system-ui;';
    this.el.append(this.starEl, this.targetEl, this.exitBtn);
    root.appendChild(this.el);
  }

  show(starName: string, onExit: () => void): void {
    this.starEl.textContent = `恒星: ${starName}`;
    this.targetEl.textContent = '目標: —';
    this.exitBtn.onclick = onExit;
    this.el.style.display = 'block';
  }

  setTarget(name: string | null): void {
    this.targetEl.textContent = `目標: ${name ?? '—'}`;
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
```

- [ ] **Step 3: app.ts を mode 分岐に再構成**

`src/app.ts` を次の構造に変更する（M1 の galaxy 挙動は温存）:
- `type AppMode = 'galaxy' | 'system'` を保持する変数 `mode`。
- galaxy 用の状態（engine, origin, ship, input, catalog, field, hud, panel, yawPitch）は M1 のまま。
- 突入: InfoPanel の `onEnterSystem` で `enterSystem(index)` を呼ぶ。
  - `savedPos = [...origin.position]`, `savedQuat = ship.orientation.clone()` を退避。
  - `system = buildStellarSystem(catalog.columns, index, catalog.nameOf(index))`。
  - `systemScene = new SystemScene(system)`。`engine.scene.remove(field.object)` し `engine.scene.add(systemScene.root)`。
  - `origin.setPosition(0, 0, 8)`（恒星の少し手前, AU）、`ship.orientation` を原点向きへリセット、`yawPitch` リセット。
  - `systemHud.show(system.starName, exitSystem)`、`panel.hide()`、`mode = 'system'`。
- 退出: `exitSystem()`:
  - `engine.scene.remove(systemScene.root)`, `systemScene.dispose()`, `engine.scene.add(field.object)`。
  - `origin.setPosition(...savedPos)`, `ship.orientation.copy(savedQuat)`, `yawPitch` を savedQuat 相当へ（簡易に yaw/pitch を 0 リセットでも可、ただし復帰位置は savedPos）。
  - `systemHud.hide()`, `mode = 'galaxy'`。
- frame ループ: 共通で pointer delta→yawPitch→orientation、throttle、`ship.update(dt)`、`camera.quaternion.copy`。
  - `mode === 'galaxy'`: `field.updateOrigin(origin)`, `hud.update(...)`。
  - `mode === 'system'`: `systemScene.root` は原点固定なのでカメラ位置を `origin.position` から反映する必要がある。**system ビューではカメラをワールドに置く**: `engine.camera.position.set(origin.position[0], origin.position[1], origin.position[2])`（AU 単位、floating origin 不要な近距離）。`systemHud` 更新。
- pointerdown ハンドラも mode 分岐（galaxy=星 pick / system=惑星 pick は Task 7 で追加。Task 6 時点では system の pointerdown は何もしなくてよい）。

**注意（floating origin と system ビュー）:** galaxy ビューは floating origin（カメラ原点固定・星を相対描画）。system ビューは AU スケールで近距離なので、カメラを実座標に置く方式に切替える。M1 の StarField は galaxy 専用。system では `engine.camera.position` を直接動かす。ShipController は `origin` を動かすので、system では毎フレーム `camera.position ← origin.position` で反映する（上記）。

InfoPanel 呼出は galaxy の pointerdown 内で:
```ts
panel.show(describeStar(catalog.columns, idx, catalog.nameOf(idx)), () => enterSystem(idx));
```

- [ ] **Step 4: 型チェック / ビルド**

Run: `npx tsc --noEmit` → クリーン。
Run: `npm run build`（監査 hook が出たら `# CLAUDE_AUDIT_OK` 付きで再実行）→ 成功。
Run: `npm test` → 全緑（既存 + 新規、app.ts/SystemHud は単体テストなし）。

- [ ] **Step 5: コミット**

```bash
git add src/app.ts src/ui/InfoPanel.ts src/ui/SystemHud.ts
git -c commit.gpgsign=false commit -m "feat: add galaxy/system mode switch with enter/exit transition" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 系内飛行 + 惑星選択 + PlanetPanel

**Files:**
- Modify: `src/app.ts`（system モードの飛行・惑星 pick を追加）
- Create: `src/ui/PlanetPanel.ts`（惑星情報パネル・日本語）
- Create: `src/system/planetPick.ts`（レイ最近傍の惑星を選ぶ純粋関数）
- Test: `tests/system/planetPick.test.ts`, `tests/ui/planetFormat.test.ts`

**Interfaces:**
- Consumes: `StellarSystem`/`Planet`（Task 1）, `orbitPosition`/`planetPhase`（Task 4）, `SystemScene`（Task 5）
- Produces:
  - `pickPlanet(cameraPos: [number,number,number], rayDir: [number,number,number], system: StellarSystem, maxAngleRad: number): number | null`（惑星 index or null、方式は M1 の pickStar と同様の角度最小）
  - `describePlanet(planet: Planet): string`（PlanetPanel 表示用の整形。日本語）→ もしくは PlanetPanel 内に整形を内包
  - `class PlanetPanel { constructor(root); show(planet: Planet): void; hide(): void }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/system/planetPick.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pickPlanet } from '../../src/system/planetPick';
import type { StellarSystem } from '../../src/system/types';

// 惑星の実座標は orbitPosition(a, planetPhase(starIndex,i)) で決まる。
// starIndex=0 の位相に依存するため、テストは「正面にある惑星が選ばれる」ことを、
// カメラを惑星実座標の少し手前に置いて確認する。
import { orbitPosition, planetPhase } from '../../src/system/orbit';

const system: StellarSystem = {
  starIndex: 0, starName: 'T', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
  planets: [
    { name: '1番惑星', type: 'rock', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1, eqTempK: null, inHabitableZone: true, isReal: false, estimated: false },
    { name: '2番惑星', type: 'gas', semiMajorAxisAu: 5, radiusEarth: 11, massEarth: 300, eqTempK: null, inHabitableZone: false, isReal: false, estimated: false },
  ],
};

describe('pickPlanet', () => {
  it('selects the planet the ray points at', () => {
    const p1 = orbitPosition(5, planetPhase(0, 1)); // planet index 1
    const cam: [number,number,number] = [p1[0] - 0.5 * (p1[0]/5), p1[1], p1[2] - 0.5 * (p1[2]/5)];
    // ray from cam toward p1
    const dir: [number,number,number] = [p1[0]-cam[0], p1[1]-cam[1], p1[2]-cam[2]];
    expect(pickPlanet(cam, dir, system, 0.1)).toBe(1);
  });
  it('returns null when pointing away from all planets', () => {
    expect(pickPlanet([0,0,0], [0,1,0], system, 0.01)).toBeNull();
  });
});
```

`tests/ui/planetFormat.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { describePlanet } from '../../src/ui/PlanetPanel';
import type { Planet } from '../../src/system/types';

const p: Planet = {
  name: '2番惑星', type: 'ocean', semiMajorAxisAu: 1.2, radiusEarth: 1.5, massEarth: 3,
  eqTempK: 280, inHabitableZone: true, isReal: true, estimated: false,
};

describe('describePlanet', () => {
  it('produces Japanese fields including type, orbit, HZ flag, badge', () => {
    const s = describePlanet(p);
    expect(s).toMatch(/海洋/);       // type label in Japanese
    expect(s).toMatch(/1\.2/);       // orbit AU
    expect(s).toMatch(/ハビタブル/); // HZ mention
    expect(s).toMatch(/実在/);       // real badge
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- planetPick planetFormat`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/system/planetPick.ts`:
```ts
import type { StellarSystem } from './types';
import { orbitPosition, planetPhase } from './orbit';

export function pickPlanet(
  cameraPos: [number, number, number],
  rayDir: [number, number, number],
  system: StellarSystem,
  maxAngleRad: number,
): number | null {
  const rlen = Math.hypot(rayDir[0], rayDir[1], rayDir[2]) || 1;
  const rx = rayDir[0] / rlen, ry = rayDir[1] / rlen, rz = rayDir[2] / rlen;
  let bestDot = Math.cos(maxAngleRad);
  let best: number | null = null;
  system.planets.forEach((p, i) => {
    const [px, py, pz] = orbitPosition(p.semiMajorAxisAu, planetPhase(system.starIndex, i));
    const dx = px - cameraPos[0], dy = py - cameraPos[1], dz = pz - cameraPos[2];
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return;
    const dot = (dx * rx + dy * ry + dz * rz) / len;
    if (dot >= bestDot) { bestDot = dot; best = i; }
  });
  return best;
}
```

`src/ui/PlanetPanel.ts`:
```ts
import type { Planet, PlanetType } from '../system/types';

const TYPE_LABEL: Record<PlanetType, string> = {
  rock: '岩石惑星', ocean: '海洋惑星', gas: 'ガス惑星', ice: '氷惑星',
};

export function describePlanet(p: Planet): string {
  const badge = p.isReal ? '実在' : '生成';
  const hz = p.inHabitableZone ? 'ハビタブルゾーン内' : 'ハビタブルゾーン外';
  const est = p.estimated ? '（推定値）' : '';
  const temp = p.eqTempK != null ? `平衡温度: ${Math.round(p.eqTempK)} K\n` : '';
  return `${p.name}（${badge}）\n` +
    `種別: ${TYPE_LABEL[p.type]}\n` +
    `軌道長半径: ${p.semiMajorAxisAu.toPrecision(3)} AU\n` +
    `半径: 地球の ${p.radiusEarth.toPrecision(3)} 倍${est}\n` +
    `質量: 地球の ${p.massEarth.toPrecision(3)} 倍${est}\n` +
    temp +
    `${hz}`;
}

export class PlanetPanel {
  private readonly el: HTMLDivElement;
  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;right:16px;top:16px;min-width:220px;color:#eaf2ff;' +
      'background:rgba(8,14,28,0.82);border:1px solid #2b4a7a;border-radius:8px;' +
      'padding:12px 16px;font:13px/1.6 system-ui,sans-serif;white-space:pre-line;display:none;';
    root.appendChild(this.el);
  }
  show(planet: Planet): void {
    this.el.textContent = describePlanet(planet); // textContent で XSS 回避
    this.el.style.display = 'block';
  }
  hide(): void { this.el.style.display = 'none'; }
}
```

- [ ] **Step 4: app.ts に系内飛行・惑星 pick を結線**

- system モードの frame でカメラを `origin.position` に置き（Task 6 で実施済み）、`ship.update(dt)` で飛行。
- system モードの pointerdown:
```ts
// system モード時
const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.orientation);
const pIdx = pickPlanet(
  [origin.position[0], origin.position[1], origin.position[2]],
  [dir.x, dir.y, dir.z], currentSystem, 0.05,
);
if (pIdx != null) { planetPanel.show(currentSystem.planets[pIdx]!); systemHud.setTarget(currentSystem.planets[pIdx]!.name); }
```
- `planetPanel = new PlanetPanel(root)` を galaxy の panel と併存で生成。突入時に `planetPanel.hide()`、退出時も `hide()`。
- system の速度域は AU スケールに合わせ、`ShipController` の定数はそのまま使うと速すぎる可能性がある。体感が速すぎる場合は system モードで `ship.throttle` の適用に係数を掛ける（実装者判断、まず既定で試し、コントローラの目視で調整）。

**受入基準（目視・コントローラ）:** 突入後、自由飛行で系内を動け、惑星をクリックすると PlanetPanel に日本語情報（種別・軌道・半径・質量・HZ・実在/生成）が出て、SystemHud の目標名が更新される。

- [ ] **Step 5: テスト / ビルド確認**

Run: `npm test -- planetPick planetFormat` → PASS。`npm test` 全緑。`npx tsc --noEmit` クリーン。`npm run build` 成功（`# CLAUDE_AUDIT_OK`）。

- [ ] **Step 6: コミット**

```bash
git add src/app.ts src/system/planetPick.ts src/ui/PlanetPanel.ts tests/system/planetPick.test.ts tests/ui/planetFormat.test.ts
git -c commit.gpgsign=false commit -m "feat: add in-system flight, planet picking, and planet panel" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 型別惑星シェーダー（PlanetMaterial）+ クローズアップ

**Files:**
- Create: `src/planets/PlanetMaterial.ts`, `src/planets/planet.vert.glsl`, `src/planets/planet.frag.glsl`
- Modify: `src/system/SystemScene.ts`（惑星の MeshStandardMaterial を PlanetMaterial に差替え）
- Test: `tests/planets/planetMaterial.test.ts`

**Interfaces:**
- Consumes: `PlanetType`（Task 1）, three, glsl `?raw`（vite/client の型で解決、M1 の StarField と同様）
- Produces:
  - `makePlanetMaterial(type: PlanetType, seed: number, starDir: THREE.Vector3): THREE.ShaderMaterial`
  - uniforms: `uType`(int 0=rock,1=ocean,2=gas,3=ice), `uSeed`(float), `uStarDir`(vec3)。
  - `SystemScene` の惑星メッシュが PlanetMaterial を使う。`SystemScene` は星方向（原点方向）を各惑星に渡す。

型別分岐は 1 本のフラグメントシェーダー内で `uType` により切替える（ガス=帯縞 FBM、
岩石=クレーター風 FBM の陰影、海洋=青+雲、氷=白+亀裂）。全型に大気フレネルリム。

**検証:** `makePlanetMaterial` が正しい uniforms/型を持つ ShaderMaterial を返すことを単体テスト
（uniform 値・型の存在）。実際の見た目はコントローラが Playwright で目視。

- [ ] **Step 1: 失敗するテストを書く**

`tests/planets/planetMaterial.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makePlanetMaterial } from '../../src/planets/PlanetMaterial';

describe('makePlanetMaterial', () => {
  it('returns a ShaderMaterial with type/seed/starDir uniforms', () => {
    const m = makePlanetMaterial('gas', 3, new THREE.Vector3(1, 0, 0));
    expect(m).toBeInstanceOf(THREE.ShaderMaterial);
    expect(m.uniforms.uType!.value).toBe(2); // gas -> 2
    expect(m.uniforms.uSeed!.value).toBe(3);
    expect((m.uniforms.uStarDir!.value as THREE.Vector3).x).toBe(1);
  });
  it('maps each type to a distinct uType index', () => {
    const idx = (['rock','ocean','gas','ice'] as const).map(
      (t) => makePlanetMaterial(t, 0, new THREE.Vector3()).uniforms.uType!.value,
    );
    expect(new Set(idx).size).toBe(4);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- planetMaterial`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/planets/planet.vert.glsl`:
```glsl
varying vec3 vNormal;
varying vec3 vPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

`src/planets/planet.frag.glsl`:
```glsl
uniform int uType;      // 0 rock, 1 ocean, 2 gas, 3 ice
uniform float uSeed;
uniform vec3 uStarDir;  // ワールドでの恒星方向（正規化済み）
varying vec3 vNormal;
varying vec3 vPos;

// 簡易ハッシュノイズ
float hash(vec3 p) {
  p = fract(p * 0.3183099 + uSeed);
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i);
  float n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0));
  float n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1));
  float n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1));
  float n111 = hash(i + vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
             mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 base;
  if (uType == 2) {              // gas: 帯状の縞
    float band = fbm(vec3(vPos.y * 8.0, uSeed, 0.0));
    base = mix(vec3(0.85,0.62,0.38), vec3(0.95,0.85,0.6), band);
  } else if (uType == 1) {       // ocean: 青 + 雲
    float cloud = smoothstep(0.55, 0.8, fbm(vPos * 3.0));
    base = mix(vec3(0.15,0.35,0.6), vec3(1.0), cloud);
  } else if (uType == 3) {       // ice: 白 + 亀裂
    float crack = smoothstep(0.5, 0.52, fbm(vPos * 6.0));
    base = mix(vec3(0.8,0.9,0.95), vec3(0.5,0.7,0.85), crack);
  } else {                       // rock: クレーター風
    float r = fbm(vPos * 5.0);
    base = mix(vec3(0.4,0.3,0.24), vec3(0.7,0.55,0.4), r);
  }
  // 恒星方向ライティング（昼夜）
  float lambert = clamp(dot(n, normalize(uStarDir)), 0.0, 1.0);
  vec3 col = base * (0.15 + 0.85 * lambert);
  // 大気フレネルリム
  float rim = pow(1.0 - clamp(dot(n, vec3(0.0,0.0,1.0)), 0.0, 1.0), 3.0);
  col += rim * vec3(0.3,0.5,0.8) * (0.4 + 0.6 * lambert);
  gl_FragColor = vec4(col, 1.0);
}
```

`src/planets/PlanetMaterial.ts`:
```ts
import * as THREE from 'three';
import type { PlanetType } from '../system/types';
import vert from './planet.vert.glsl?raw';
import frag from './planet.frag.glsl?raw';

const TYPE_INDEX: Record<PlanetType, number> = { rock: 0, ocean: 1, gas: 2, ice: 3 };

export function makePlanetMaterial(
  type: PlanetType, seed: number, starDir: THREE.Vector3,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uType: { value: TYPE_INDEX[type] },
      uSeed: { value: seed },
      uStarDir: { value: starDir.clone() },
    },
    vertexShader: vert,
    fragmentShader: frag,
  });
}
```

- [ ] **Step 4: SystemScene で PlanetMaterial を使う**

`src/system/SystemScene.ts` の惑星メッシュ生成で `MeshStandardMaterial` を
`makePlanetMaterial(p.type, system.starIndex + i, starDir)` に差替える。`starDir` は
各惑星位置から原点（恒星）への方向: `new THREE.Vector3(-x, -y, -z).normalize()`。
（`systemScene.test.ts` の「5 メッシュ」判定はマテリアル種別に依存しないので通り続ける。
PointLight は PlanetMaterial が自前ライティングするため不要になるが、残しても無害。
リング/恒星の Basic マテリアルは据え置き。）

- [ ] **Step 5: テスト / ビルド確認**

Run: `npm test -- planetMaterial systemScene` → PASS。`npm test` 全緑。`npx tsc --noEmit` クリーン。`npm run build` 成功（`# CLAUDE_AUDIT_OK`）。

**受入基準（目視・コントローラ）:** 惑星に接近すると型ごとに異なる表面（ガスの縞・岩石の起伏・海と雲・氷）+ 大気リム + 昼夜境界が見える。

- [ ] **Step 6: コミット**

```bash
git add src/planets tests/planets/planetMaterial.test.ts src/system/SystemScene.ts
git -c commit.gpgsign=false commit -m "feat: add type-specific procedural planet shaders" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: カタログパーサに ID 列を追加（NASA 結合の前提）

**Files:**
- Modify: `scripts/build-catalog.ts`（`parseHygCsv` の戻り値に `ids` を追加、非破壊）
- Test: `tests/catalog/buildCatalog.test.ts`（既存に ID 抽出テストを追加）

**Interfaces:**
- Consumes: 既存 `parseHygCsv`/`parseCsvLine`
- Produces:
  - `parseHygCsv(text): { columns: StarColumns; names: Record<number,string>; ids: StarIds[] }`
  - `interface StarIds { hd: string; hip: string; gl: string; proper: string }`（**出力 index** 順の配列）
  - 既存の `columns`/`names` は不変（追加のみ）。既存テストは壊さない。

NASA 結合（Task 10）は HYG の `hd`/`hip`/`gl` 列で突合するため、出力 index と ID の対応が必要。

- [ ] **Step 1: 失敗するテストを追加**

`tests/catalog/buildCatalog.test.ts` に追記（既存フィクスチャは `id,proper,mag,absmag,ci,x,y,z`
で hd/hip/gl 列を持たない。ID 抽出テスト用に **インラインの CSV** を使う）:
```ts
import { parseHygCsv } from '../../scripts/build-catalog';

describe('parseHygCsv ids', () => {
  const csv = [
    'id,hip,hd,gl,proper,mag,absmag,ci,x,y,z',
    '1,32349,48915,Gl 244A,Sirius,-1.44,1.45,0.0,-1.1,-1.9,1.2',
    '2,,,,,3.0,5.0,0.6,2.0,3.0,4.0',
  ].join('\n');

  it('returns ids aligned to output index', () => {
    const { ids, columns } = parseHygCsv(csv);
    expect(columns.count).toBe(2);
    expect(ids.length).toBe(2);
    expect(ids[0]).toEqual({ hd: '48915', hip: '32349', gl: 'Gl 244A', proper: 'Sirius' });
    expect(ids[1]).toEqual({ hd: '', hip: '', gl: '', proper: '' });
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- buildCatalog`
Expected: FAIL（`ids` 未実装）

- [ ] **Step 3: 実装**

`scripts/build-catalog.ts` の `parseHygCsv` を変更:
- `StarIds` 型を export で追加。
- `hd`/`hip`/`gl` 列インデックスを取得（存在しない CSV では欠落を許容し空文字にする。
  つまり `header.indexOf('hd')` が -1 の場合はその ID を常に空文字とする）。
- ループ内で、行が採用される（フィルタを通過する）たびに `ids.push({ hd, hip, gl, proper })`
  を **columns と同じ順序** で行う（proper は既存の names 収集と同じ値）。
- 戻り値に `ids` を追加。

実装指針（既存コードへの差分の要点）:
```ts
export interface StarIds { hd: string; hip: string; gl: string; proper: string }

export function parseHygCsv(text: string): { columns: StarColumns; names: Record<number, string>; ids: StarIds[] } {
  // ...既存の header 解析...
  const idx = (name: string) => header.indexOf(name); // -1 許容
  const iHd = idx('hd'), iHip = idx('hip'), iGl = idx('gl');
  // ...
  const ids: StarIds[] = [];
  // 採用行ごと（既存の x.push(...) と同じ位置）で:
  const cell = (f: string[], i: number) => (i >= 0 ? (f[i] ?? '').trim() : '');
  ids.push({ hd: cell(f, iHd), hip: cell(f, iHip), gl: cell(f, iGl), proper });
  // ...
  return { columns, names, ids };
}
```
（既存の `col('mag')` 等は必須列で -1 なら throw のまま。hd/hip/gl は任意列なので
`indexOf` を直接使い -1 を許容する点に注意。既存フィクスチャ `sample-hyg.csv` は
hd/hip/gl を持たないので `ids[i]` はそれらが空文字になる — 既存テストは `ids` を見ないので不変。）

- [ ] **Step 4: テスト確認**

Run: `npm test -- buildCatalog` → PASS（既存 + 新規）。`npm test` 全緑。`npx tsc --noEmit` クリーン。

- [ ] **Step 5: コミット**

```bash
git add scripts/build-catalog.ts tests/catalog/buildCatalog.test.ts
git -c commit.gpgsign=false commit -m "feat: expose star catalog IDs (hd/hip/gl) per output index" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: NASA 系外惑星の結合 + ローダ + 実在データ配線

**Files:**
- Create: `scripts/build-exoplanets.ts`, `src/catalog/exoplanets.ts`
- Modify: `src/app.ts`（起動時に exoplanets をロードし buildStellarSystem に渡す）
- Modify: `README.md`（NASA 出典を追記）
- Test: `tests/catalog/buildExoplanets.test.ts`

**Interfaces:**
- Consumes: `parseHygCsv`（Task 9 の `ids`）, `Planet`/`PlanetType`（Task 1）, `inHabitableZone`（Task 1）
- Produces:
  - `joinExoplanets(ids: StarIds[], nasaRows: NasaRow[]): Record<number, Planet[]>`（純粋関数、テスト対象）
  - `interface NasaRow { hostname: string; hostHd: string; hostHip: string; hostGl: string; plName: string; smaxAu: number | null; radiusEarth: number | null; massEarth: number | null; eqTempK: number | null }`
  - CLI `main()`: NASA TAP を取得（or ローカル CSV）し `data/hygdata_v3.csv` の ids と突合、`public/data/exoplanets.json` を出力
  - `loadExoplanets(url: string): Promise<Record<number, Planet[]>>`（ローダ、失敗時 `{}`）

- [ ] **Step 1: 失敗するテストを書く**

`tests/catalog/buildExoplanets.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { joinExoplanets } from '../../scripts/build-exoplanets';
import type { StarIds } from '../../scripts/build-catalog';

const ids: StarIds[] = [
  { hd: '48915', hip: '32349', gl: 'Gl 244A', proper: 'Sirius' }, // index 0
  { hd: '', hip: '', gl: '', proper: 'Sol' },                     // index 1
];

describe('joinExoplanets', () => {
  it('joins a NASA row to the star index by HD id', () => {
    const rows = [{ hostname: 'Sirius', hostHd: '48915', hostHip: '', hostGl: '', plName: 'Sirius b', smaxAu: 2.0, radiusEarth: 5, massEarth: 20, eqTempK: 400 }];
    const map = joinExoplanets(ids, rows);
    expect(map[0]).toBeDefined();
    expect(map[0]!.length).toBe(1);
    expect(map[0]![0]!.isReal).toBe(true);
    expect(map[0]![0]!.semiMajorAxisAu).toBe(2.0);
    expect(map[1]).toBeUndefined();
  });
  it('falls back to proper-name match when ids empty', () => {
    const rows = [{ hostname: 'Sol', hostHd: '', hostHip: '', hostGl: '', plName: 'Sol c', smaxAu: 1.0, radiusEarth: 1, massEarth: 1, eqTempK: 288 }];
    const map = joinExoplanets(ids, rows);
    expect(map[1]).toBeDefined();
    expect(map[1]![0]!.name).toBe('Sol c');
  });
  it('marks estimated when radius/mass missing', () => {
    const rows = [{ hostname: 'Sirius', hostHd: '48915', hostHip: '', hostGl: '', plName: 'Sirius b', smaxAu: 2.0, radiusEarth: null, massEarth: null, eqTempK: null }];
    const map = joinExoplanets(ids, rows);
    expect(map[0]![0]!.estimated).toBe(true);
    expect(map[0]![0]!.radiusEarth).toBeGreaterThan(0); // filled with a default
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- buildExoplanets`
Expected: FAIL

- [ ] **Step 3: 実装**

`scripts/build-exoplanets.ts`:
```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseHygCsv, type StarIds } from './build-catalog';
import type { Planet, PlanetType } from '../src/system/types';

export interface NasaRow {
  hostname: string; hostHd: string; hostHip: string; hostGl: string;
  plName: string; smaxAu: number | null; radiusEarth: number | null;
  massEarth: number | null; eqTempK: number | null;
}

// 半径から型を推定（詳細な判定は生成側に任せ、実データは簡易分類）
function inferType(radiusEarth: number): PlanetType {
  if (radiusEarth >= 6) return 'gas';
  if (radiusEarth >= 2.5) return 'ice';
  return 'rock';
}

export function joinExoplanets(ids: StarIds[], nasaRows: NasaRow[]): Record<number, Planet[]> {
  const byHd = new Map<string, number>(), byHip = new Map<string, number>(),
    byGl = new Map<string, number>(), byProper = new Map<string, number>();
  ids.forEach((id, i) => {
    if (id.hd) byHd.set(id.hd, i);
    if (id.hip) byHip.set(id.hip, i);
    if (id.gl) byGl.set(id.gl, i);
    if (id.proper) byProper.set(id.proper, i);
  });
  const out: Record<number, Planet[]> = {};
  for (const r of nasaRows) {
    let idx: number | undefined;
    if (r.hostHd && byHd.has(r.hostHd)) idx = byHd.get(r.hostHd);
    else if (r.hostHip && byHip.has(r.hostHip)) idx = byHip.get(r.hostHip);
    else if (r.hostGl && byGl.has(r.hostGl)) idx = byGl.get(r.hostGl);
    else if (r.hostname && byProper.has(r.hostname)) idx = byProper.get(r.hostname);
    if (idx == null) continue;
    const estimated = r.radiusEarth == null || r.massEarth == null;
    const radiusEarth = r.radiusEarth ?? 1.0;
    const massEarth = r.massEarth ?? Math.pow(radiusEarth, 3);
    const planet: Planet = {
      name: r.plName,
      type: inferType(radiusEarth),
      semiMajorAxisAu: r.smaxAu ?? 1.0,
      radiusEarth,
      massEarth,
      eqTempK: r.eqTempK,
      inHabitableZone: false, // 実データでは軌道と恒星光度から後段で判定してもよいが M2a では false 固定でも可
      isReal: true,
      estimated,
    };
    (out[idx] ??= []).push(planet);
  }
  return out;
}

// CLI: NASA CSV（ローカル data/nasa-exoplanets.csv）を読み、HYG と突合して JSON 出力
function parseNasaCsv(text: string): NasaRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith('#'));
  const header = lines[0]!.split(',');
  const col = (n: string) => header.indexOf(n);
  const iHost = col('hostname'), iHd = col('hd'), iHip = col('hip'), iGl = col('gl'),
    iPl = col('pl_name'), iSma = col('pl_orbsmax'), iRad = col('pl_rade'),
    iMass = col('pl_bmasse'), iTeq = col('pl_eqt');
  const num = (v: string | undefined) => { const n = Number(v); return v && Number.isFinite(n) ? n : null; };
  const rows: NasaRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = lines[i]!.split(',');
    rows.push({
      hostname: (f[iHost] ?? '').trim(),
      hostHd: iHd >= 0 ? (f[iHd] ?? '').trim() : '',
      hostHip: iHip >= 0 ? (f[iHip] ?? '').trim() : '',
      hostGl: iGl >= 0 ? (f[iGl] ?? '').trim() : '',
      plName: (f[iPl] ?? '').trim(),
      smaxAu: num(f[iSma]), radiusEarth: num(f[iRad]), massEarth: num(f[iMass]), eqTempK: num(f[iTeq]),
    });
  }
  return rows;
}

function main(): void {
  const { ids } = parseHygCsv(readFileSync('data/hygdata_v3.csv', 'utf8'));
  const rows = parseNasaCsv(readFileSync('data/nasa-exoplanets.csv', 'utf8'));
  const map = joinExoplanets(ids, rows);
  mkdirSync('public/data', { recursive: true });
  writeFileSync('public/data/exoplanets.json', JSON.stringify(map));
  console.log(`joined ${Object.keys(map).length} systems from ${rows.length} NASA rows`);
}

if (process.argv[1] && process.argv[1].endsWith('build-exoplanets.ts')) main();
```

`src/catalog/exoplanets.ts`:
```ts
import type { Planet } from '../system/types';

export async function loadExoplanets(url: string): Promise<Record<number, Planet[]>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    return (await res.json()) as Record<number, Planet[]>;
  } catch {
    return {};
  }
}
```

- [ ] **Step 4: app.ts で実データを配線**

`startApp` 内でカタログロード後に `const exoplanets = await loadExoplanets('/data/exoplanets.json');`
（失敗時 `{}`）。`enterSystem(index)` の `buildStellarSystem(...)` 呼出に第 4 引数として
`exoplanets` を渡す。これで実在惑星がある星は本物の惑星（実在バッジ）、無い星は手続き生成。

`package.json` に `"build:exoplanets": "tsx scripts/build-exoplanets.ts"` を追加。

- [ ] **Step 5: README に NASA 出典を追記**

`README.md` の クレジット節に追記:
```markdown
- 系外惑星データ — NASA Exoplanet Archive（自由利用可、出典明記）
```
（M1 で「M2 以降」と書いた行があれば実データ利用中の表現に更新。）

- [ ] **Step 6: テスト / ビルド確認**

Run: `npm test -- buildExoplanets` → PASS。`npm test` 全緑。`npx tsc --noEmit` クリーン。`npm run build` 成功（`# CLAUDE_AUDIT_OK`）。
（実 NASA データの取得・突合・実機目視はコントローラが M1 の HYG と同様に実施する。）

- [ ] **Step 7: コミット**

```bash
git add scripts/build-exoplanets.ts src/catalog/exoplanets.ts src/app.ts package.json README.md tests/catalog/buildExoplanets.test.ts
git -c commit.gpgsign=false commit -m "feat: join NASA exoplanet data to stars and wire real planets" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review（計画作成者による点検結果）

**1. Spec coverage（M2a）:**
- 突入/退出（選択→ボタン→AU 系）: Task 6 ✓
- 惑星データ 実在+手続き（NASA 結合 + 生成）: Task 2, 3, 9, 10 ✓
- 型別惑星シェーダー（ガス/岩石/海洋/氷 + 大気リム + 恒星ライティング）: Task 8 ✓
- 系内自由飛行 + 軌道リング + 惑星選択 + PlanetPanel: Task 5, 6, 7 ✓
- ハビタブルゾーン: Task 1 ✓
- 決定論生成: Task 2, 3, 4 ✓
- テスト（決定論・NASA 結合・HZ・型判定・軌道変換）: Task 1,2,3,4,7,10 ✓
- クレジット（NASA 出典）: Task 10 ✓
- 静止配置（公転アニメなし）・着陸なし・衛星/リング作り込みなし: スコープ外として非実装 ✓

**2. Placeholder scan:** 純粋モジュールは全ステップにコード実体。描画/結線タスク（6,7,8,10）は
M1 の Task 12 と同じ方式で「精密な手順 + 完全なコード断片 + 受入基準 + コントローラ目視」。
TBD/TODO なし。

**3. Type consistency:**
- `Planet`/`StellarSystem`/`PlanetType` は Task 1 定義を Task 2/3/5/7/8/10 が一貫使用。
- `buildStellarSystem(columns, index, name, exoplanets?)` は Task 3 定義を Task 6/10 が使用、一致。
- `orbitPosition`/`planetPhase` は Task 4 定義を Task 5/7 が使用、一致。
- `StarIds`（hd/hip/gl/proper）は Task 9 定義を Task 10 が使用、一致。
- `makePlanetMaterial(type, seed, starDir)` は Task 8 定義、SystemScene から使用。
- 既知の設計上の判断: system ビューは floating origin を使わず `camera.position ← origin.position`
  で AU 実座標に置く（Task 6 で明示）。galaxy ビューの floating origin は不変。

**4. 回帰リスク:** app.ts の mode 分岐再構成は M1 galaxy 挙動に影響しうる。Task 6/7 完了後、
コントローラが Playwright で M1 の星野・飛行・ワープ・星選択の回帰有無を必ず再確認する。

---

## 実行方式

M1 と同じく **Subagent-Driven** を推奨。純粋モジュール（Task 1〜5, 9）は完全コードの転記 +
TDD で cheap モデル、描画/結線（Task 6,7,8,10）は wiring 判断を伴うため標準モデル、最終レビューは
最上位モデル。各描画タスク後にコントローラが実データ + Playwright でエンドツーエンド検証する。


