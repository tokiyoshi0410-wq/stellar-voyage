# 太陽の銀河公転（道を流す）＋一時停止 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 太陽系ビューで太陽は中心に静止したまま、銀河公転の道すじ（金の弧）に沿って道標を流し太陽の移動を描写する。加えて ⏸/▶ ボタン＋Space キーで公転アニメと道流しを一時停止し、静止した惑星をクリックできるようにする。

**Architecture:** 純関数 `galacticPath.ts`（弧点・道標の流れ位相）を追加。`SystemScene`（太陽系のみ）に道標マーカー群＋小矢印を足し `update(t)` で `animT` 連動で流す。`app.ts` は `paused` フラグで `animT += dt` をゲートするだけで、惑星公転・道流し・ラベル・クリックが同じ `animT` を共有しているため一括凍結。⏸ は新規 `PauseButton`、Space は `InputMapper` のエッジ。

**Tech Stack:** TypeScript (strict + noUncheckedIndexedAccess), Three.js, Vitest (環境 jsdom), Vite。

## Global Constraints

- ユーザー向け文言は日本語。ワールド単位 AU。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。テストは `tests/` 配下、`import ... from '../../src/...'`。vitest の既定環境は jsdom（`window`/DOM 利用可）。
- コミット末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。署名エラー時 `git -c commit.gpgsign=false commit`。`--no-verify` 禁止。
- ビルド系は監査 hook が発火。テスト済み・隔離済みなら末尾に `# CLAUDE_AUDIT_OK`（Task 4 のみ build 確認）。

## 実装ポリシー: TDD 厳密ゾーン と 実機調整ゾーン（サブエージェント必読）

- **◆ TDD 厳密ゾーン**: `galacticPathPoint`（a=0=原点・弧式）、`galacticMarkerParam`（範囲 (-π/3,π/3]・t=0 等間隔・t 増で減少＝後方へ流れる・周期）、`InputMapper.consumePauseToggle`（Space エッジ・auto-repeat 非再発火）、`SystemScene.update(t)` で道標メッシュが動く。
- **◆ 実機調整ゾーン（テストで固定しない）**: 流す速度 `GAL_FLOW_SPEED`・マーカー数/サイズ・矢印/ラベルの見え方・`PauseButton` の配置。**具体秒数・座標・数値そのものは assert しない**（範囲・等間隔・単調性・周期のみ）。

## File Structure

```
src/system/galacticPath.ts       # 新規: galacticPathPoint, galacticMarkerParam, 定数
src/system/SystemScene.ts        # 改修: 道標マーカー群+小矢印(solar), update(t) で道標を流す
src/ui/PauseButton.ts            # 新規: ⏸/▶ トグルボタン（DOM, 単体テストなし）
src/nav/InputMapper.ts           # 改修: Space エッジ (consumePauseToggle)
src/app.ts                       # 改修: paused/togglePause・animT ゲート・PauseButton/Space 結線・太陽ラベル文言
tests/system/galacticPath.test.ts   # 新規
tests/nav/inputMapper.test.ts       # 新規（jsdom で keydown を dispatch）
tests/system/systemScene.test.ts    # 追記: solar で update(t) 後に道標が動く / 非solar は道標0
```

**タスク順（依存）:** 1 galacticPath（独立）／2 InputMapper（独立）→ 3 SystemScene（1 に依存）→ 4 PauseButton+app 結線（1,2,3 に依存, 描画=コントローラ E2E）。

---

### Task 1: galacticPath.ts（弧点・道標の流れ・純関数）

**Files:**
- Create: `src/system/galacticPath.ts`
- Test: `tests/system/galacticPath.test.ts`

**Interfaces:**
- Produces: `galacticPathPoint(a: number, R?: number): [number, number, number]`, `galacticMarkerParam(k: number, count: number, t: number, flowSpeed: number): number`, 定数 `GAL_PATH_R`, `GAL_ARC_SPAN`, `GAL_MARKER_COUNT`, `GAL_FLOW_SPEED`

> **ゾーン区分:** 弧式・範囲・等間隔・流れ方向・周期は TDD 厳密。`GAL_MARKER_COUNT`/`GAL_FLOW_SPEED` の値は実機調整（値そのものを assert しない）。

- [ ] **Step 1: 失敗テストを作成** — `tests/system/galacticPath.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  galacticPathPoint, galacticMarkerParam, GAL_ARC_SPAN,
} from '../../src/system/galacticPath';

describe('galacticPathPoint', () => {
  it('puts the Sun (a=0) at the origin', () => {
    expect(galacticPathPoint(0)).toEqual([0, 0, 0]);
  });
  it('matches the arc formula at a=π/3', () => {
    const [x, y, z] = galacticPathPoint(Math.PI / 3, 40);
    expect(x).toBeCloseTo(40 * Math.sin(Math.PI / 3), 9);
    expect(y).toBe(0);
    expect(z).toBeCloseTo(-40 + 40 * Math.cos(Math.PI / 3), 9);
  });
});

describe('galacticMarkerParam', () => {
  it('stays within (-π/3, π/3]', () => {
    for (let k = 0; k < 6; k++) {
      for (const t of [0, 1, 3.3, 10, 50]) {
        const p = galacticMarkerParam(k, 6, t, 0.15);
        expect(p).toBeGreaterThan(-Math.PI / 3 - 1e-9);
        expect(p).toBeLessThanOrEqual(Math.PI / 3 + 1e-9);
      }
    }
  });
  it('spaces markers evenly at t=0', () => {
    const p0 = galacticMarkerParam(0, 6, 0, 0.15);
    const p1 = galacticMarkerParam(1, 6, 0, 0.15);
    const p2 = galacticMarkerParam(2, 6, 0, 0.15);
    expect(p0 - p1).toBeCloseTo(p1 - p2, 9);
  });
  it('flows backward: param decreases as t increases (before wrap)', () => {
    expect(galacticMarkerParam(0, 6, 0.5, 0.15)).toBeLessThan(galacticMarkerParam(0, 6, 0, 0.15));
  });
  it('loops with period GAL_ARC_SPAN / flowSpeed', () => {
    const period = GAL_ARC_SPAN / 0.15;
    expect(galacticMarkerParam(2, 6, 1 + period, 0.15)).toBeCloseTo(galacticMarkerParam(2, 6, 1, 0.15), 9);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/galacticPath.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装** — `src/system/galacticPath.ts`

```ts
export const GAL_PATH_R = 40;                    // 弧半径（AU, 見栄え）
export const GAL_ARC_SPAN = (2 * Math.PI) / 3;   // 弧の全角 120°（a∈[-π/3, π/3]）
export const GAL_MARKER_COUNT = 6;               // 道標の数（実機調整）
export const GAL_FLOW_SPEED = 0.15;              // rad/秒（実機調整）

/** 弧パラメータ a での道すじ座標（0.35 の傾き適用前。太陽=a=0=原点）。 */
export function galacticPathPoint(a: number, R = GAL_PATH_R): [number, number, number] {
  return [R * Math.sin(a), 0, -R + R * Math.cos(a)];
}

/**
 * 道標マーカー k（全 count 個, 等間隔）の時刻 t での弧パラメータ。
 * 前方(+π/3)→太陽(0)→後方(-π/3) へ流れてループ（車と道路）。flowSpeed rad/秒。
 * 返り値は (-π/3, π/3] にラップ。
 */
export function galacticMarkerParam(k: number, count: number, t: number, flowSpeed: number): number {
  const raw = (k / count) * GAL_ARC_SPAN + t * flowSpeed;
  const wrapped = ((raw % GAL_ARC_SPAN) + GAL_ARC_SPAN) % GAL_ARC_SPAN; // [0, SPAN)
  return Math.PI / 3 - wrapped;                                          // [+π/3 .. -π/3)（減少）
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/system/galacticPath.test.ts` → PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/system/galacticPath.ts tests/system/galacticPath.test.ts
git -c commit.gpgsign=false commit -m "feat: add galacticPath helpers (arc point + flowing marker phase)"
```

---

### Task 2: InputMapper に Space のポーズ・エッジ

**Files:**
- Modify: `src/nav/InputMapper.ts`
- Test: `tests/nav/inputMapper.test.ts`（新規, jsdom）

**Interfaces:**
- Produces: `InputMapper.consumePauseToggle(): boolean`（Space の物理押下ごとに一度だけ true）

> **ゾーン区分:** Space エッジ・auto-repeat 非再発火・consume で false 化は TDD 厳密。

- [ ] **Step 1: 失敗テストを作成** — `tests/nav/inputMapper.test.ts`（既定 jsdom 環境なので `window`/`document` 利用可）

```ts
import { describe, it, expect } from 'vitest';
import { InputMapper } from '../../src/nav/InputMapper';

const kd = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
const ku = () => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));

describe('InputMapper.consumePauseToggle', () => {
  it('fires once per physical Space press and clears on consume', () => {
    const im = new InputMapper(document.createElement('div'));
    expect(im.consumePauseToggle()).toBe(false);   // 無押下
    kd();
    expect(im.consumePauseToggle()).toBe(true);     // 押下でエッジ
    expect(im.consumePauseToggle()).toBe(false);    // consume 済
    kd();                                            // auto-repeat（keyup 無し）
    expect(im.consumePauseToggle()).toBe(false);    // 再発火しない
    ku(); kd();                                      // 離して再押下
    expect(im.consumePauseToggle()).toBe(true);     // 再びエッジ
    im.dispose();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/nav/inputMapper.test.ts`
Expected: FAIL（`consumePauseToggle` 未定義）

- [ ] **Step 3: 実装** — `src/nav/InputMapper.ts`

フィールド追加（`private readonly keys = new Set<string>();` の近く）:
```ts
  private pauseToggleRequested = false;
```

`onKeyDown` を差し替え（`keys.add` の**前**に Space エッジ判定, auto-repeat は `keys.has` で除外）:
```ts
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !this.keys.has('Space')) {
      this.pauseToggleRequested = true;
      e.preventDefault();
    }
    this.keys.add(e.code);
  };
```

メソッド追加（`consumeWheel` の近く）:
```ts
  consumePauseToggle(): boolean {
    const v = this.pauseToggleRequested;
    this.pauseToggleRequested = false;
    return v;
  }
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/nav/inputMapper.test.ts` → PASS
Run: `npx vitest run` → 全テスト PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/nav/InputMapper.ts tests/nav/inputMapper.test.ts
git -c commit.gpgsign=false commit -m "feat: InputMapper.consumePauseToggle (Space edge, no auto-repeat)"
```

---

### Task 3: SystemScene に流れる道標マーカー＋小矢印（太陽系のみ）

**Files:**
- Modify: `src/system/SystemScene.ts`
- Test: `tests/system/systemScene.test.ts`（追記）

**Interfaces:**
- Consumes: `galacticPathPoint`, `galacticMarkerParam`, `GAL_PATH_R`, `GAL_ARC_SPAN`, `GAL_MARKER_COUNT`, `GAL_FLOW_SPEED`（Task 1）
- Produces: 公開 `SystemScene.galMarkers: THREE.Mesh[]`（太陽系のみ非空）。`update(t)` が道標を流す。

> **ゾーン区分:** 「solar で update(t) 後に道標が動く／非solar は道標0」は TDD 厳密。マーカー数/サイズ/色/矢印の見え方は実機調整。

- [ ] **Step 1: 失敗テストを追記** — `tests/system/systemScene.test.ts`（`GAL_MARKER_COUNT` を import、`StellarSystem` 型は既存 import 利用）

```ts
  it('solar system has flowing galactic-path markers that move with update(t)', () => {
    const sys: StellarSystem = {
      starIndex: 0, starName: '太陽', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
      planets: [],
    };
    const scene = new SystemScene(sys);
    expect(scene.galMarkers.length).toBe(GAL_MARKER_COUNT);
    const before = scene.galMarkers[0]!.position.clone();
    scene.update(3);
    expect(scene.galMarkers[0]!.position.distanceTo(before)).toBeGreaterThan(0);
    scene.dispose();
  });
  it('non-solar system has no galactic-path markers', () => {
    const sys: StellarSystem = {
      starIndex: 5, starName: 'x', spectralClass: 'K', temperatureK: 4000, luminositySun: 0.3,
      planets: [],
    };
    const scene = new SystemScene(sys);
    expect(scene.galMarkers.length).toBe(0);
    scene.dispose();
  });
```

（`import { GAL_MARKER_COUNT } from '../../src/system/galacticPath';` を追加。`import type { StellarSystem } from '../../src/system/types';` が無ければ追加。）

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/systemScene.test.ts`
Expected: FAIL（`galMarkers` 未定義）

- [ ] **Step 3: 実装** — `src/system/SystemScene.ts`

先頭 import に追加:
```ts
import {
  galacticPathPoint, galacticMarkerParam, GAL_ARC_SPAN, GAL_MARKER_COUNT, GAL_FLOW_SPEED,
} from './galacticPath';
```

公開フィールド追加（`readonly planetMeshes` の近く）:
```ts
  readonly galMarkers: THREE.Mesh[] = [];
```

`if (system.starIndex === 0) { ... }` ブロックを次に差し替え（金の弧は galacticPathPoint 利用に・道標群・小矢印を追加）:
```ts
    if (system.starIndex === 0) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 96; i++) {
        const a = -Math.PI / 3 + (i / 96) * GAL_ARC_SPAN;
        pts.push(new THREE.Vector3(...galacticPathPoint(a)));
      }
      const orbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.7 }),
      );
      orbitLine.rotation.x = 0.35;
      this.root.add(orbitLine);

      // 道標マーカー: 金の弧に沿って流れて太陽の移動を示す。弧と同じ傾きのグループ配下。
      const markerGroup = new THREE.Group();
      markerGroup.rotation.x = 0.35;
      for (let k = 0; k < GAL_MARKER_COUNT; k++) {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.85 }),
        );
        const [x, y, z] = galacticPathPoint(galacticMarkerParam(k, GAL_MARKER_COUNT, 0, GAL_FLOW_SPEED));
        m.position.set(x, y, z);
        this.galMarkers.push(m);
        markerGroup.add(m);
      }
      this.root.add(markerGroup);

      // 小さな進行方向の矢印（太陽から前方=+X, 弧の接線）。以前の大矢印とは別物・小さい。
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 5, 0xffd479, 2, 1.2,
      );
      this.root.add(arrow);
    }
```

`update(t)` の惑星ループの**後**に道標の流しを追加:
```ts
    this.galMarkers.forEach((m, k) => {
      const [x, y, z] = galacticPathPoint(galacticMarkerParam(k, GAL_MARKER_COUNT, t, GAL_FLOW_SPEED));
      m.position.set(x, y, z);
    });
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/system/systemScene.test.ts` → PASS
Run: `npx vitest run` → 全テスト PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/system/SystemScene.ts tests/system/systemScene.test.ts
git -c commit.gpgsign=false commit -m "feat: flowing galactic-path markers + forward arrow in solar view"
```

---

### Task 4: PauseButton + app.ts 結線（一時停止・道標・太陽ラベル）— 描画タスク

**Files:**
- Create: `src/ui/PauseButton.ts`
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `InputMapper.consumePauseToggle`（Task 2）; `SystemScene`（道標は Task 3, 追加結線不要 — 既存の `systemScene.update(animT)` が流す）
- Produces: なし（結線）。**単体テストなし** — 描画/操作タスクのためコントローラが Playwright E2E で検証（Step 6）。

> **ゾーン区分:** 結線（`if(!paused) animT+=dt` で一括凍結・Space/ボタンで toggle）は E2E で検証。ボタン配置は実機調整。

- [ ] **Step 1: PauseButton を作成** — `src/ui/PauseButton.ts`

```ts
export class PauseButton {
  private readonly btn: HTMLButtonElement;

  constructor(root: HTMLElement, onToggle: () => void) {
    this.btn = document.createElement('button');
    this.btn.style.cssText =
      'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);' +
      'padding:6px 14px;border:1px solid #6a7a9a;border-radius:6px;' +
      'background:rgba(20,28,44,0.8);color:#eaf2ff;font:13px system-ui,sans-serif;' +
      'cursor:pointer;text-shadow:0 0 4px #000;';
    this.btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btn.addEventListener('click', (e) => { e.stopPropagation(); onToggle(); });
    root.appendChild(this.btn);
    this.setPaused(false);
  }

  setPaused(paused: boolean): void {
    this.btn.textContent = paused ? '▶ 再生' : '⏸ 停止';
  }
}
```

- [ ] **Step 2: app.ts に import** — `src/app.ts`

`import { SpeedSlider } from './ui/SpeedSlider';`（14行目付近）の下に:
```ts
import { PauseButton } from './ui/PauseButton';
```

- [ ] **Step 3: paused 状態と PauseButton** — `const slider = new SpeedSlider(root);`（66行目付近）の直後に:
```ts
  let paused = false;
  function togglePause(): void { paused = !paused; pauseButton.setPaused(paused); }
  const pauseButton = new PauseButton(root, togglePause);
```

- [ ] **Step 4: animT をゲート＋Space 結線** — frame ループ内の `animT += dt;`（183行目付近）を次に置換:
```ts
    if (!paused) animT += dt;
    if (input.consumePauseToggle()) togglePause();
```

- [ ] **Step 5: 太陽ラベルを「移動中」に** — 惑星/太陽ラベル構築の太陽ラベル（257行目付近）:
```ts
          text: `太陽 ・ 公転 ${SUN_FACTS.galacticSpeedKmS}km/s（クリックで詳細）`,
```
を次に置換:
```ts
          text: `太陽 ・ 銀河を ${SUN_FACTS.galacticSpeedKmS}km/s で移動中（クリックで詳細）`,
```

- [ ] **Step 6: 型・ビルド・全テスト**

Run: `npx tsc --noEmit` → エラーなし
Run: `npx vitest run` → 全テスト PASS
Run: `npm run build # CLAUDE_AUDIT_OK` → 成功

- [ ] **Step 7: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/ui/PauseButton.ts src/app.ts
git -c commit.gpgsign=false commit -m "feat: pause toggle (button + Space) + moving-Sun label"
```

- [ ] **Step 8: コントローラが Playwright E2E で受入基準を検証**

`npm run dev`（→ `http://localhost:5181`）で:
1. 太陽系ビューで太陽は中心に静止したまま、金の道すじ上を道標が前方→後方へ流れる。小矢印＋「銀河を 220km/s で移動中」ラベル。
2. ⏸ ボタン（または Space）で公転アニメと道流しが止まる。▶（または Space）で再開。ボタン表示が切替。
3. 停止中に惑星をクリックで選択でき正しいパネルが出る。停止操作自体では選択が起きない。
4. 手続き系（starIndex≠0）では道標/矢印は出ない・従来通り。停止は全系で効く。

**描画/操作タスクのため、Step 8 の E2E が通るまで Task 4 は未完。** 流す速度・ボタン配置は live-tune で調整。

---

## Self-Review（記入済み — spec との照合）

**Spec coverage:**
- 弧点・道標の流れ純関数 → Task 1 ✅
- Space エッジ pause トグル → Task 2 ✅
- 道標マーカー＋小矢印＋update 流し（太陽系のみ）→ Task 3 ✅
- PauseButton・animT ゲート・Space 結線・太陽ラベル文言 → Task 4 ✅
- 受入基準 1〜4 → Task 4 Step 8 ✅

**Placeholder scan:** 各コード step に完全コードあり。曖昧語なし。

**Type consistency:** `galacticPathPoint`/`galacticMarkerParam`/定数（Task 1）→ Task 3 消費で一致。`consumePauseToggle`（Task 2）→ Task 4 消費で一致。`galMarkers`（Task 3, public）→ テストが参照。`PauseButton(root, onToggle)`/`setPaused`（Task 4）→ app.ts 消費で一致。`togglePause` は関数宣言で巻き上げ、`pauseButton` は const（toggle は click 時=代入後に実行, TDZ 無し）。

**未解決の実装時判断（実装者が現物で確定）:** app.ts の該当行番号は現行（66/183/257 付近）に合わせて内容一致で置換。`PauseButton` は `SpeedSlider` と同じ `root` にマウント。道標の流しは既存 `systemScene.update(animT)` が担うので Task 4 に追加結線は不要（paused で animT 凍結→道標も止まる）。
