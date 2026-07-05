# 局部銀河群の 3D 銀河（Phase 1）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一番ズームアウトした局部銀河群段で、DOM 模式図に代えて天の川銀河とアンドロメダ銀河を 3D 渦巻きパーティクルで描き、アンドロメダへ前進すると近づける。

**Architecture:** 既存フォーカス相対空間（AU 単位）に 2 つの渦巻きパーティクル銀河を固定配置した THREE.Group を置き、毎フレーム `group.position = -focusWorldAu` で相対化（カメラは既存の原点周回のまま）。`localGroupFade(viewDistanceAu)` で近傍星野をフェードアウト・銀河群をフェードインする。銀河は決定論生成（`mulberry32` 再利用）。

**Tech Stack:** TypeScript (strict + noUncheckedIndexedAccess), Three.js, GLSL (`?raw` import), Vitest, Vite。

## Global Constraints

- ユーザー向け文言は**日本語**、小学生が読める平易な表現。ワールド単位 **AU**。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。純粋ロジックは vitest 単体、描画/フェード/遷移は Playwright 目視（コントローラ）。
- 銀河生成は決定論（seed 固定、`src/system/rng.ts` の `mulberry32` を再利用）。
- コミットはタスク単位、メッセージ末尾に `Co-Authored-By: Claude <実装モデル> <noreply@anthropic.com>`。署名エラー時は `git -c commit.gpgsign=false commit`。`--no-verify` 禁止。
- ビルド系コマンド（`npm run build` 等）は監査 hook が発火。テスト済み・隔離済みなら末尾に `# CLAUDE_AUDIT_OK`。ただし本計画のタスクは `npm test` / `npx tsc --noEmit` のみで完結（build 不要）。
- 全オーバーレイは `pointer-events:none`、既存配置（ScalePanel=左上/ScaleBar=左下/InfoPanel=右上）は不変。
- テストは `tests/` 配下、`import ... from '../../src/...'` の相対パス（既存慣習）。

## 実装ポリシー: TDD 厳密ゾーン と 実機調整ゾーン（サブエージェント必読）

このミルストーンは「決定論的な純粋ロジック」と「実機で見た目を合わせる描画・見栄え」が混在する。**両者を区別して実装すること。**

**◆ TDD 厳密ゾーン（純粋ロジック・構造的不変条件）** — superpowers の TDD で厳密に。失敗テスト→最小実装→通過、完全コード転記。レビューでも厳密に検証する:
- `localGroupFade` の数値境界・単調性（Task 1）
- `buildGalaxyGeometry` の**決定性・要素数・半径/厚み範囲内・色クランプ[0,1]・バルジが中心近傍**（Task 2）
- `GalaxyDisk`/`LocalGroup`/`StarField` の**構造**：object 型・子の数・uniform の存在と反映・`markerWorldPos`/`midpointWorldPos` が `setPosition` を反映（Task 3,4,5）

**◆ 実機調整ゾーン（見栄えパラメータ・テストで値を固定しない）** — コントローラが Task 6 Step 8 の Playwright E2E で目視調整する。**具体的な見た目の数値をテストで assert しないこと**（調整のたびにテストが壊れ、調整を妨げる）:
- `galaxyParams` の具体値: `count`/`radiusAu`/`armCount`/`windings`/`thicknessAu`/`bulgeFraction`/`coreColor`/`armColor`/`ANDROMEDA_OFFSET_AU`
- `GalaxyDisk` の `uPixelScale`・alpha カーブ・additive の見え方
- `LocalGroup` の `rotation`（銀河の傾き）・アンドロメダ配置・現在地マーカーの位置と見た目
- シェーダの色・サイズの出方

**原則: 見た目の数値そのものを assert しない。構造的不変条件（範囲・決定性・存在・伝播）だけをテストする。** これらの定数を plan の値のまま実装するのは「初期値」であり、最終的な見え方は実機 E2E で確定・微調整する。テストは値を変えても壊れないように書くこと。

## File Structure

```
src/nav/localGroupFade.ts           # 新規（純粋）: viewDistanceAu→[0,1] フェード係数
src/galaxy/galaxyParams.ts          # 新規: GalaxyParams 型 + 天の川/アンドロメダ定数
src/galaxy/GalaxyDisk.ts            # 新規: buildGalaxyGeometry(純粋) + GalaxyDisk クラス
src/galaxy/galaxy.vert.glsl         # 新規シェーダ
src/galaxy/galaxy.frag.glsl         # 新規シェーダ
src/galaxy/LocalGroup.ts            # 新規: 天の川+アンドロメダ+現在地マーカー束ね
src/starfield/StarField.ts          # 改修: uOpacity uniform + setOpacity
src/starfield/starfield.frag.glsl   # 改修: alpha * uOpacity
src/app.ts                          # 改修: 結線・フェード・ラベル・旧 DOM 模式図撤去
src/ui/LocalGroupDiagram.ts         # 削除
tests/nav/localGroupFade.test.ts    # 新規
tests/galaxy/galaxyDisk.test.ts     # 新規
tests/galaxy/localGroup.test.ts     # 新規
tests/starfield/starField.test.ts   # 追記（既存なければ新規）: setOpacity
```

**タスク順（依存）:** 1 localGroupFade（独立）→ 2 galaxyParams+buildGalaxyGeometry（独立）→ 3 シェーダ+GalaxyDisk（2 に依存）→ 4 LocalGroup（3 に依存）→ 5 StarField uOpacity（独立）→ 6 app.ts 結線（1,4,5 に依存）。

---

### Task 1: localGroupFade（純関数）

**Files:**
- Create: `src/nav/localGroupFade.ts`
- Test: `tests/nav/localGroupFade.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `localGroupFade(viewDistanceAu: number): number`（0〜1、smoothstep）; `export const LOCALGROUP_FADE_START_AU = 3e9`, `LOCALGROUP_FADE_END_AU = 1e10`

- [ ] **Step 1: 失敗するテストを書く** — `tests/nav/localGroupFade.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { localGroupFade } from '../../src/nav/localGroupFade';

describe('localGroupFade', () => {
  it('is 0 at or below the start (3e9)', () => {
    expect(localGroupFade(3e9)).toBe(0);
    expect(localGroupFade(1e9)).toBe(0);
  });
  it('is 1 at or above the end (1e10)', () => {
    expect(localGroupFade(1e10)).toBe(1);
    expect(localGroupFade(5e10)).toBe(1);
  });
  it('is ~0.5 at the band midpoint (6.5e9)', () => {
    expect(localGroupFade(6.5e9)).toBeCloseTo(0.5, 5);
  });
  it('increases monotonically across the band', () => {
    let prev = -1;
    for (let v = 3e9; v <= 1e10; v += 5e8) {
      const f = localGroupFade(v);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/nav/localGroupFade.test.ts`
Expected: FAIL（`localGroupFade` が存在しない）

- [ ] **Step 3: 最小実装** — `src/nav/localGroupFade.ts`

```ts
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const LOCALGROUP_FADE_START_AU = 3e9;
export const LOCALGROUP_FADE_END_AU = 1e10;

export function localGroupFade(viewDistanceAu: number): number {
  const t = clamp(
    (viewDistanceAu - LOCALGROUP_FADE_START_AU) / (LOCALGROUP_FADE_END_AU - LOCALGROUP_FADE_START_AU),
    0, 1,
  );
  return t * t * (3 - 2 * t);
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run tests/nav/localGroupFade.test.ts` → PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Global Constraints の Co-Authored-By trailer）

```bash
git add src/nav/localGroupFade.ts tests/nav/localGroupFade.test.ts
git -c commit.gpgsign=false commit -m "feat: add localGroupFade (star-field↔galaxy crossfade factor)"
```

---

### Task 2: galaxyParams + buildGalaxyGeometry（決定論生成）

**Files:**
- Create: `src/galaxy/galaxyParams.ts`, `src/galaxy/GalaxyDisk.ts`（この Task では `buildGalaxyGeometry` のみ。クラスは Task 3）
- Test: `tests/galaxy/galaxyDisk.test.ts`

**Interfaces:**
- Consumes: `mulberry32(seed: number): () => number`（`src/system/rng.ts`、既存）
- Produces:
  - `interface GalaxyParams { count; radiusAu; armCount; windings; thicknessAu; bulgeFraction; coreColor:[number,number,number]; armColor:[number,number,number] }`
  - `const MILKY_WAY: GalaxyParams`, `const ANDROMEDA: GalaxyParams`, `const ANDROMEDA_OFFSET_AU = 2.4e10`
  - `buildGalaxyGeometry(p: GalaxyParams, seed: number): { positions: Float32Array; colors: Float32Array; sizes: Float32Array }`

> **ゾーン区分:** `galaxyParams` の数値・色は**実機調整ゾーン**（初期値。テストで値を assert しない）。`buildGalaxyGeometry` は**構造が TDD 厳密ゾーン**（決定性・要素数・半径/厚み範囲・色クランプ・バルジ中心近傍）だが、腕の巻き方・色勾配など**見た目そのものは E2E で調整**する。テストは範囲・決定性・クランプのみを検証し、特定の座標値や特定の色値を assert しないこと。

- [ ] **Step 1: パラメータ定数を書く** — `src/galaxy/galaxyParams.ts`

```ts
export interface GalaxyParams {
  count: number;
  radiusAu: number;
  armCount: number;
  windings: number;
  thicknessAu: number;
  bulgeFraction: number;
  coreColor: [number, number, number];
  armColor: [number, number, number];
}

export const MILKY_WAY: GalaxyParams = {
  count: 8000, radiusAu: 4e9, armCount: 2, windings: 2.5, thicknessAu: 3e8,
  bulgeFraction: 0.15, coreColor: [1.0, 0.95, 0.8], armColor: [0.7, 0.8, 1.0],
};

export const ANDROMEDA: GalaxyParams = {
  count: 12000, radiusAu: 8e9, armCount: 2, windings: 3.0, thicknessAu: 5e8,
  bulgeFraction: 0.18, coreColor: [1.0, 0.9, 0.7], armColor: [0.8, 0.85, 1.0],
};

/** 天の川中心からアンドロメダ中心までの概念距離（天の川直径 8e9 の約3倍先） */
export const ANDROMEDA_OFFSET_AU = 2.4e10;
```

- [ ] **Step 2: 失敗するテストを書く** — `tests/galaxy/galaxyDisk.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildGalaxyGeometry } from '../../src/galaxy/GalaxyDisk';
import { MILKY_WAY } from '../../src/galaxy/galaxyParams';

describe('buildGalaxyGeometry', () => {
  it('is deterministic for a given seed', () => {
    const a = buildGalaxyGeometry(MILKY_WAY, 1);
    const b = buildGalaxyGeometry(MILKY_WAY, 1);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.colors)).toEqual(Array.from(b.colors));
  });
  it('produces count-sized arrays', () => {
    const g = buildGalaxyGeometry(MILKY_WAY, 1);
    expect(g.positions.length).toBe(MILKY_WAY.count * 3);
    expect(g.colors.length).toBe(MILKY_WAY.count * 3);
    expect(g.sizes.length).toBe(MILKY_WAY.count);
  });
  it('keeps every point within radius*1.05 and thickness', () => {
    const g = buildGalaxyGeometry(MILKY_WAY, 1);
    for (let i = 0; i < MILKY_WAY.count; i++) {
      const x = g.positions[i * 3]!, y = g.positions[i * 3 + 1]!, z = g.positions[i * 3 + 2]!;
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(MILKY_WAY.radiusAu * 1.05);
      expect(Math.abs(y)).toBeLessThanOrEqual(MILKY_WAY.thicknessAu);
    }
  });
  it('clamps all color components to [0,1]', () => {
    const g = buildGalaxyGeometry(MILKY_WAY, 1);
    for (const c of g.colors) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(1); }
  });
  it('places bulge points (first fraction) near the center', () => {
    const g = buildGalaxyGeometry(MILKY_WAY, 1);
    const bulge = Math.floor(MILKY_WAY.count * MILKY_WAY.bulgeFraction);
    for (let i = 0; i < bulge; i++) {
      const x = g.positions[i * 3]!, y = g.positions[i * 3 + 1]!, z = g.positions[i * 3 + 2]!;
      expect(Math.hypot(x, y, z)).toBeLessThanOrEqual(MILKY_WAY.radiusAu * 0.15 + 1);
    }
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run tests/galaxy/galaxyDisk.test.ts`
Expected: FAIL（`buildGalaxyGeometry` が `src/galaxy/GalaxyDisk.ts` に無い）

- [ ] **Step 4: buildGalaxyGeometry を実装** — `src/galaxy/GalaxyDisk.ts`（新規、この Task では生成関数のみ export。Task 3 でクラスを追記）

```ts
import { mulberry32 } from '../system/rng';
import type { GalaxyParams } from './galaxyParams';

export function buildGalaxyGeometry(p: GalaxyParams, seed: number): {
  positions: Float32Array; colors: Float32Array; sizes: Float32Array;
} {
  const n = p.count;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  const rng = mulberry32(seed);
  const bulgeCount = Math.floor(n * p.bulgeFraction);
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  for (let i = 0; i < n; i++) {
    let x: number, y: number, z: number, r: number, g: number, b: number, s: number;
    if (i < bulgeCount) {
      // 中心バルジ: 半径 radiusAu*0.15 の（やや扁平な）球状分布
      const br = p.radiusAu * 0.15 * Math.cbrt(rng());
      const u = rng() * 2 - 1;
      const phi = rng() * Math.PI * 2;
      const sr = Math.sqrt(1 - u * u);
      x = br * sr * Math.cos(phi);
      y = br * u * 0.6;
      z = br * sr * Math.sin(phi);
      r = p.coreColor[0]; g = p.coreColor[1]; b = p.coreColor[2];
      s = 2.2;
    } else {
      // 円盤: 対数螺旋の腕 + 角度ジッター、XZ が円盤面
      const radius = p.radiusAu * Math.sqrt(rng());
      const arm = i % p.armCount;
      const armAngle = (arm * Math.PI * 2) / p.armCount;
      const spiral = armAngle + p.windings * Math.PI * 2 * (radius / p.radiusAu);
      const angle = spiral + (rng() - 0.5) * 0.5;
      x = radius * Math.cos(angle);
      z = radius * Math.sin(angle);
      const t = radius / p.radiusAu;
      y = (rng() - 0.5) * p.thicknessAu * (1 - 0.7 * t);
      const cj = (rng() - 0.5) * 0.05;
      r = p.coreColor[0] + (p.armColor[0] - p.coreColor[0]) * t + cj;
      g = p.coreColor[1] + (p.armColor[1] - p.coreColor[1]) * t + cj;
      b = p.coreColor[2] + (p.armColor[2] - p.coreColor[2]) * t + cj;
      s = 1.6 + (0.7 - 1.6) * t;
    }
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    colors[i * 3] = clamp01(r); colors[i * 3 + 1] = clamp01(g); colors[i * 3 + 2] = clamp01(b);
    sizes[i] = s;
  }
  return { positions, colors, sizes };
}
```

- [ ] **Step 5: テスト通過を確認**

Run: `npx vitest run tests/galaxy/galaxyDisk.test.ts` → PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 6: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/galaxy/galaxyParams.ts src/galaxy/GalaxyDisk.ts tests/galaxy/galaxyDisk.test.ts
git -c commit.gpgsign=false commit -m "feat: add galaxy params + deterministic spiral-disk geometry"
```

---

### Task 3: シェーダ + GalaxyDisk クラス

**Files:**
- Create: `src/galaxy/galaxy.vert.glsl`, `src/galaxy/galaxy.frag.glsl`
- Modify: `src/galaxy/GalaxyDisk.ts`（先頭に import 追加、末尾に `GalaxyDisk` クラス追加）
- Test: `tests/galaxy/galaxyDisk.test.ts`（`GalaxyDisk` の describe を追記）

**Interfaces:**
- Consumes: `buildGalaxyGeometry`, `GalaxyParams`, `MILKY_WAY`（Task 2）
- Produces: `class GalaxyDisk { readonly object: THREE.Points; constructor(p: GalaxyParams, seed: number); setOpacity(o: number): void; dispose(): void }`。uniforms は `uPixelScale`, `uOpacity`。

> **ゾーン区分:** object が `Points`・頂点数一致・`setOpacity` が `uOpacity` uniform に反映、は**TDD 厳密ゾーン**。`uPixelScale` の値・シェーダの alpha カーブ・additive の見え方は**実機調整ゾーン**（テストは構造のみ、点の大きさや明るさを assert しない）。

- [ ] **Step 1: シェーダ 2 ファイルを作成** — `src/galaxy/galaxy.vert.glsl`

```glsl
uniform float uPixelScale;
attribute float size;
varying vec3 vColor;

void main() {
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * uPixelScale / max(-mv.z, 0.001), 1.0, 24.0);
}
```

`src/galaxy/galaxy.frag.glsl`

```glsl
uniform float uOpacity;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float alpha = 1.0 - smoothstep(0.0, 0.5, length(uv));
  gl_FragColor = vec4(vColor, alpha * uOpacity);
}
```

- [ ] **Step 2: 失敗するテストを追記** — `tests/galaxy/galaxyDisk.test.ts` の末尾

```ts
import { GalaxyDisk } from '../../src/galaxy/GalaxyDisk';

describe('GalaxyDisk', () => {
  it('exposes a Points object with count vertices', () => {
    const d = new GalaxyDisk(MILKY_WAY, 1);
    expect(d.object.type).toBe('Points');
    expect(d.object.geometry.getAttribute('position').count).toBe(MILKY_WAY.count);
    d.dispose();
  });
  it('setOpacity updates the uOpacity uniform', () => {
    const d = new GalaxyDisk(MILKY_WAY, 1);
    d.setOpacity(0.3);
    expect((d.object.material as THREE.ShaderMaterial).uniforms.uOpacity!.value).toBe(0.3);
    d.dispose();
  });
});
```

（先頭の import 群に `import * as THREE from 'three';` を追加。）

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run tests/galaxy/galaxyDisk.test.ts`
Expected: FAIL（`GalaxyDisk` が未 export）

- [ ] **Step 4: GalaxyDisk クラスを実装** — `src/galaxy/GalaxyDisk.ts` の**先頭 import に追加**

```ts
import * as THREE from 'three';
import vert from './galaxy.vert.glsl?raw';
import frag from './galaxy.frag.glsl?raw';
```

**ファイル末尾に追記:**

```ts
export class GalaxyDisk {
  readonly object: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(p: GalaxyParams, seed: number) {
    const { positions, colors, sizes } = buildGalaxyGeometry(p, seed);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uPixelScale: { value: 400.0 }, uOpacity: { value: 1.0 } },
      vertexShader: vert,
      fragmentShader: frag,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.object = new THREE.Points(geometry, this.material);
    this.object.frustumCulled = false;
  }

  setOpacity(o: number): void {
    this.material.uniforms.uOpacity!.value = o;
  }

  dispose(): void {
    this.object.geometry.dispose();
    this.material.dispose();
  }
}
```

- [ ] **Step 5: テスト通過を確認**

Run: `npx vitest run tests/galaxy/galaxyDisk.test.ts` → PASS（buildGalaxyGeometry + GalaxyDisk 両 describe）
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 6: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/galaxy/galaxy.vert.glsl src/galaxy/galaxy.frag.glsl src/galaxy/GalaxyDisk.ts tests/galaxy/galaxyDisk.test.ts
git -c commit.gpgsign=false commit -m "feat: add GalaxyDisk (additive spiral-disk Points + opacity)"
```

---

### Task 4: LocalGroup（天の川 + アンドロメダ + 現在地マーカー束ね）

**Files:**
- Create: `src/galaxy/LocalGroup.ts`
- Test: `tests/galaxy/localGroup.test.ts`

**Interfaces:**
- Consumes: `GalaxyDisk`（Task 3）; `MILKY_WAY`, `ANDROMEDA`, `ANDROMEDA_OFFSET_AU`（Task 2）
- Produces: `class LocalGroup { readonly object: THREE.Group; constructor(); setOpacity(o: number): void; setPosition(x: number, y: number, z: number): void; markerWorldPos(): [number,number,number]; midpointWorldPos(): [number,number,number]; dispose(): void }`

> **ゾーン区分:** 子の数・`setOpacity` 伝播・`markerWorldPos`/`midpointWorldPos` が `setPosition` を反映、は**TDD 厳密ゾーン**。銀河の `rotation`（傾き）・アンドロメダ配置・現在地マーカーの見た目/位置は**実機調整ゾーン**。テストは絶対座標を assert せず、`setPosition` の差分・相対関係のみ検証すること（配置調整でテストが壊れないように）。

- [ ] **Step 1: 失敗するテストを書く** — `tests/galaxy/localGroup.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { LocalGroup } from '../../src/galaxy/LocalGroup';
import { ANDROMEDA_OFFSET_AU } from '../../src/galaxy/galaxyParams';

describe('LocalGroup', () => {
  it('contains two galaxy Points objects', () => {
    const lg = new LocalGroup();
    const points = lg.object.children.filter((c) => c.type === 'Points');
    expect(points.length).toBe(2);
    lg.dispose();
  });
  it('setOpacity propagates to both disks', () => {
    const lg = new LocalGroup();
    lg.setOpacity(0.4);
    for (const c of lg.object.children) {
      const m = (c as { material?: { uniforms?: { uOpacity?: { value: number } } } }).material;
      if (m?.uniforms?.uOpacity) expect(m.uniforms.uOpacity.value).toBe(0.4);
    }
    lg.dispose();
  });
  it('midpointWorldPos reflects setPosition', () => {
    const lg = new LocalGroup();
    lg.setPosition(1000, 0, 0);
    const mid = lg.midpointWorldPos();
    expect(mid[0]).toBeCloseTo(ANDROMEDA_OFFSET_AU / 2 + 1000, 0);
    lg.dispose();
  });
  it('markerWorldPos shifts by setPosition delta', () => {
    const a = new LocalGroup();
    const base = a.markerWorldPos();
    a.setPosition(500, 0, 0);
    const moved = a.markerWorldPos();
    expect(moved[0]).toBeCloseTo(base[0] + 500, 0);
    a.dispose();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/galaxy/localGroup.test.ts`
Expected: FAIL（`LocalGroup` が存在しない）

- [ ] **Step 3: LocalGroup を実装** — `src/galaxy/LocalGroup.ts`

```ts
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
    this.object.updateWorldMatrix(true, false);
    const v = new THREE.Vector3(ANDROMEDA_OFFSET_AU / 2, 0, 0);
    this.object.localToWorld(v);
    return [v.x, v.y, v.z];
  }

  dispose(): void {
    this.milkyWay.dispose();
    this.andromeda.dispose();
    this.marker.geometry.dispose();
    (this.marker.material as THREE.Material).dispose();
  }
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run tests/galaxy/localGroup.test.ts` → PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/galaxy/LocalGroup.ts tests/galaxy/localGroup.test.ts
git -c commit.gpgsign=false commit -m "feat: add LocalGroup (Milky Way + Andromeda + 現在地 marker)"
```

---

### Task 5: StarField に uOpacity（近傍星野フェードアウト用）

**Files:**
- Modify: `src/starfield/StarField.ts`（uniforms に `uOpacity` 追加、`setOpacity` メソッド追加）
- Modify: `src/starfield/starfield.frag.glsl`（`alpha * uOpacity`）
- Test: `tests/starfield/starField.test.ts`（**既存ファイル** — `buildStarGeometry` を import 済み。`setOpacity` の describe を追記）

**Interfaces:**
- Consumes: 既存 `StarField`（constructor(columns), `object: THREE.Points`, `setFocus`）
- Produces: `StarField.setOpacity(o: number): void`。既定 uOpacity=1.0（既存描画は不変）。

> **ゾーン区分:** `uOpacity` 既定 1.0・`setOpacity` が uniform に反映、は **TDD 厳密ゾーン**。フェードの見え方（星の消え方のカーブ）は **実機調整ゾーン**。

- [ ] **Step 1: 失敗するテストを追記** — `tests/starfield/starField.test.ts`

既存ファイルに以下の describe を追記（`new StarField(cols)` の columns の作り方は既存 `tests/starfield/starFieldFocus.test.ts` のヘルパ／パターンを流用してよい。`StarColumns` の実フィールドは `src/catalog/format.ts` に従う。`buildStarGeometry` が読むのは `count`, `x`, `y`, `z`, `ci`, `mag`）:

```ts
import * as THREE from 'three';
import { StarField } from '../../src/starfield/StarField';
import type { StarColumns } from '../../src/catalog/format';

function tinyColumns(n: number): StarColumns {
  return {
    count: n,
    x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
    ci: new Float32Array(n), mag: new Float32Array(n),
  } as StarColumns;
}

describe('StarField.setOpacity', () => {
  it('defaults uOpacity to 1.0 and setOpacity updates it', () => {
    const f = new StarField(tinyColumns(3));
    const mat = f.object.material as THREE.ShaderMaterial;
    expect(mat.uniforms.uOpacity!.value).toBe(1.0);
    f.setOpacity(0.25);
    expect(mat.uniforms.uOpacity!.value).toBe(0.25);
  });
});
```

（`describe`/`it`/`expect` は既存 import を流用。`StarColumns` の実フィールドが上と異なる場合は format.ts に合わせて補う。）

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/starfield/starField.test.ts`
Expected: FAIL（`setOpacity` 未定義 or `uOpacity` uniform 不在）

- [ ] **Step 3: StarField に uOpacity を追加** — `src/starfield/StarField.ts`

uniforms へ 1 行追加（`uPixelScale` の下）:

```ts
      uPixelScale: { value: 300.0 },
      uOpacity: { value: 1.0 },
```

`setFocus` メソッドの後に追記:

```ts
  setOpacity(o: number): void {
    this.material.uniforms.uOpacity!.value = o;
  }
```

`src/starfield/starfield.frag.glsl` を差し替え:

```glsl
uniform float uOpacity;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  float alpha = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vColor, alpha * uOpacity);
}
```

- [ ] **Step 4: テスト通過を確認**

Run: `npx vitest run tests/starfield/starField.test.ts` → PASS
Run: `npx vitest run` → 全テスト PASS（既存の星野テストが uOpacity=1.0 で不変であること）
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/starfield/StarField.ts src/starfield/starfield.frag.glsl tests/starfield/starField.test.ts
git -c commit.gpgsign=false commit -m "feat: add uOpacity to StarField (for local-group crossfade)"
```

---

### Task 6: app.ts 結線 + 旧 DOM 模式図撤去（描画タスク）

**Files:**
- Modify: `src/app.ts`
- Delete: `src/ui/LocalGroupDiagram.ts`

**Interfaces:**
- Consumes: `LocalGroup`（Task 4）, `localGroupFade`（Task 1）, `StarField.setOpacity`（Task 5）
- Produces: なし（結線）。**単体テストなし** — 描画タスクのためコントローラが Playwright E2E で検証（Step 8）。

> **ゾーン区分:** 結線の正しさ（フェード・位置・ラベル・旧模式図撤去）は E2E で検証。銀河の見え方・傾き・配置・色・pixelScale の最終調整も **実機調整ゾーン**（このタスク後にコントローラが E2E で詰める）。

- [ ] **Step 1: import 差し替え** — `src/app.ts`

削除: `import { LocalGroupDiagram } from './ui/LocalGroupDiagram';`
追加（他 import の並びに）:

```ts
import { LocalGroup } from './galaxy/LocalGroup';
import { localGroupFade } from './nav/localGroupFade';
```

- [ ] **Step 2: 生成を差し替え + scene 追加**

`const localGroup = new LocalGroupDiagram(root);` を:

```ts
  const localGroup = new LocalGroup();
```

に置換。そして `engine.scene.add(field.object);` の直後に:

```ts
  engine.scene.add(localGroup.object);
```

- [ ] **Step 3: frame ループのフェード結線**（`localGroup.setVisible(...)` を置換）

`localGroup.setVisible(scaleInfo.stage === 'localgroup');` の 1 行を、以下 5 行に置換:

```ts
    const lgFade = localGroupFade(nav.viewDistanceAu);
    localGroup.object.visible = lgFade > 0;
    localGroup.setOpacity(lgFade);
    localGroup.setPosition(-nav.focusWorldAu[0], -nav.focusWorldAu[1], -nav.focusWorldAu[2]);
    field.setOpacity(1 - lgFade);
```

- [ ] **Step 4: 現在地・距離ラベルを追加**

`labelItems` を組み立てる `if (fade > 0.5) { ... } else if (...) { ... }` ブロックの**直後**（`slider.setReadout(...)` の前）に追加:

```ts
    if (lgFade > 0.5) {
      labelItems.push({ text: '現在地（太陽系）', worldPos: localGroup.markerWorldPos() });
      labelItems.push({ text: '約250万光年', worldPos: localGroup.midpointWorldPos() });
    }
```

- [ ] **Step 5: 旧 DOM 模式図を削除**

```bash
git rm src/ui/LocalGroupDiagram.ts
```

`src/ui/LocalGroupDiagram.ts` を import・参照する箇所が app.ts 以外に無いことを確認:

Run: `grep -rn "LocalGroupDiagram" src/` → app.ts の変更後は 0 件であること（0 件を確認）

- [ ] **Step 6: 型・ビルド・全テスト**

Run: `npx tsc --noEmit` → エラーなし
Run: `npx vitest run` → 全テスト PASS
Run: `npm run build # CLAUDE_AUDIT_OK` → 成功（bundle 生成）

- [ ] **Step 7: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/app.ts
git -c commit.gpgsign=false commit -m "feat: wire LocalGroup 3D galaxies + crossfade, remove DOM diagram"
```

- [ ] **Step 8: コントローラが Playwright E2E で受入基準を検証**

`npm run dev`（→ `http://localhost:5180`）を起動し、Playwright MCP で:
1. ホイールでズームアウト → 近傍星野が滑らかに消え、**2 つの渦巻き銀河**が現れる（天の川・アンドロメダ、腕とバルジが見える）。スクショで目視。
2. アンドロメダは天の川より大きく、離れて配置。天の川に「現在地（太陽系）」、中間に「約250万光年」ラベル。星名ラベルは出ない。
3. アンドロメダ方向へ前進（W、ドラッグでアンドロメダを正面に）→ 渦巻きが大きく見える。ズームインで銀河群が消え近傍星野へ戻る。
4. ドラッグ回転・ホイールズームが効き、クリック・既存パネルを妨げない（`pointer-events` 非干渉）。

**描画タスクのため、Step 8 の E2E が通るまで Task 6 は未完。** 問題があれば修正して再検証。

---

## Self-Review（記入済み — spec との照合）

**Spec coverage:**
- 概念スケール圧縮（Andromeda 2倍径・3倍先）→ Task 2 定数 ✅
- 渦巻きパーティクル生成（腕/バルジ/厚み/色勾配、決定論）→ Task 2 ✅
- 専用シェーダ additive + uOpacity → Task 3 ✅
- 天の川+アンドロメダ+現在地マーカー+250万光年中点 → Task 4 ✅
- localGroupFade クロスフェード → Task 1 ✅
- 近傍星野フェードアウト（StarField uOpacity）→ Task 5 ✅
- app 結線・旧 DOM 模式図削除・ラベル → Task 6 ✅
- Playwright 受入基準 1〜4 → Task 6 Step 8 ✅

**Placeholder scan:** 各コード step に完全コードあり。「適切に」等の曖昧語なし。

**Type consistency:** `GalaxyParams`/`buildGalaxyGeometry`/`GalaxyDisk`/`LocalGroup` のシグネチャは Task 2→3→4→6 で一致。`setOpacity(o:number)` は GalaxyDisk/LocalGroup/StarField で同名同型。`markerWorldPos`/`midpointWorldPos` は Task 4 定義 → Task 6 消費で一致。`localGroupFade`/`ANDROMEDA_OFFSET_AU` の参照名一致。

**未解決の実装時判断（実装者が現物で確定）:** `StarColumns` の正確なフィールド（format.ts 参照）、glsl `?raw` の vitest 解決（既存 StarField/PlanetMaterial テストで確認済み）、銀河の傾き/色/pixelScale の見栄えは E2E で微調整可。
