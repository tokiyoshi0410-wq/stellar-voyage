# 恒星系の公転アニメーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 恒星系ビューで惑星を軌道に沿って公転させる（内側ほど速い＝ケプラー）。惑星メッシュ・ラベル・クリック判定が同じ時間 `t` の位相を使い、動く惑星に追従・選択できる。太陽（中心星）は中心に静止。全恒星系に適用。

**Architecture:** 位相を時間で進める純関数 `animatedPhase(...,t)` を `orbit.ts` に追加し、`SystemScene.update(t)` が毎フレーム惑星メッシュ位置を更新。`app.ts` はラベルとクリック（`pickPlanet` に時間 `t` を渡す）も同じ `animatedPhase(t)` で計算するので位置が一致する。

**Tech Stack:** TypeScript (strict + noUncheckedIndexedAccess), Three.js, Vitest, Vite。

## Global Constraints

- ユーザー向け文言は日本語。ワールド単位 AU。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。テストは `tests/` 配下、`import ... from '../../src/...'`。
- コミット末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。署名エラー時 `git -c commit.gpgsign=false commit`。`--no-verify` 禁止。
- ビルド系は監査 hook が発火。テスト済み・隔離済みなら末尾に `# CLAUDE_AUDIT_OK`（Task 4 のみ build 確認）。

## 実装ポリシー: TDD 厳密ゾーン と 実機調整ゾーン（サブエージェント必読）

- **◆ TDD 厳密ゾーン**: `orbitalAngularSpeed` の**単調性**（a 小→ω 大）と**クランプの発生**、`animatedPhase` の t=0=planetPhase・ω·t 前進、`pickPlanet` が時間 t で位置を進める、`SystemScene.update(t)` で惑星メッシュ位置が変化。
- **◆ 実機調整ゾーン（テストで固定しない）**: **アニメの時間スケール**（`ANIM_EARTH_PERIOD_SEC`=地球の周回秒数）と**角速度上限**（`ANIM_MAX_OMEGA`）の具体値、見え方。**「地球=◯秒」等の具体秒数・上限値そのものを assert しない**（単調性・クランプの発生・相対関係のみ）。

## File Structure

```
src/system/orbit.ts              # 追加: orbitalAngularSpeed, animatedPhase
src/system/planetPick.ts         # 改修: pickPlanet に optional t（後方互換, 既定 0=静的）
src/system/SystemScene.ts        # 改修: update(t) + 土星の環メッシュ参照保持
src/app.ts                       # 改修: animT 累積・update 呼び出し・ラベル/クリックを animatedPhase(animT) ベースに
tests/system/orbit.test.ts       # 追記: orbitalAngularSpeed/animatedPhase
tests/system/planetPick.test.ts  # 追記: t で位置が進む
tests/system/systemScene.test.ts # 追記: update(t) で惑星メッシュ位置が変化
```

**タスク順（依存）:** 1 orbit 純関数（独立）→ 2 pickPlanet(t)（1 に依存, 後方互換で tsc 緑維持）→ 3 SystemScene.update（1 に依存）→ 4 app 結線（1,2,3 に依存, 描画=コントローラ E2E）。

---

### Task 1: orbit.ts の公転角速度・時間位相（純関数）

**Files:**
- Modify: `src/system/orbit.ts`（末尾に追加）
- Test: `tests/system/orbit.test.ts`（追記）

**Interfaces:**
- Consumes: `planetPhase(starIndex, planetIndex): number`（既存, 同ファイル）
- Produces: `orbitalAngularSpeed(semiMajorAxisAu: number): number`（rad/秒）, `animatedPhase(starIndex: number, planetIndex: number, semiMajorAxisAu: number, t: number): number`

> **ゾーン区分:** 単調性・クランプ発生・t=0・ω·t 前進は TDD 厳密。`ANIM_EARTH_PERIOD_SEC`/`ANIM_MAX_OMEGA` の値は実機調整（具体秒数・上限値を assert しない）。

- [ ] **Step 1: 失敗テストを追記** — `tests/system/orbit.test.ts`（既存 import に `orbitalAngularSpeed, animatedPhase` を追加）

```ts
import { orbitalAngularSpeed, animatedPhase, planetPhase } from '../../src/system/orbit';

describe('orbitalAngularSpeed', () => {
  it('is faster for inner orbits (monotonic decreasing in a)', () => {
    expect(orbitalAngularSpeed(0.39)).toBeGreaterThan(orbitalAngularSpeed(1));
    expect(orbitalAngularSpeed(1)).toBeGreaterThan(orbitalAngularSpeed(30));
  });
  it('clamps extremely small a to a finite max (both hit the same cap)', () => {
    expect(orbitalAngularSpeed(1e-4)).toBe(orbitalAngularSpeed(1e-6));
  });
});

describe('animatedPhase', () => {
  it('equals planetPhase at t=0', () => {
    expect(animatedPhase(0, 2, 1, 0)).toBe(planetPhase(0, 2));
  });
  it('advances by omega*t', () => {
    expect(animatedPhase(0, 2, 1, 3)).toBeCloseTo(planetPhase(0, 2) + orbitalAngularSpeed(1) * 3, 9);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/orbit.test.ts`
Expected: FAIL（`orbitalAngularSpeed`/`animatedPhase` 未定義）

- [ ] **Step 3: 実装** — `src/system/orbit.ts` の末尾に追加

```ts
const ANIM_EARTH_PERIOD_SEC = 12;                    // 地球(a=1)の周回秒数（実機調整）
const ANIM_K = (2 * Math.PI) / ANIM_EARTH_PERIOD_SEC;
const ANIM_MAX_OMEGA = Math.PI;                      // 角速度上限(≈2秒/周)。極端に内側の高速スピン防止

/** ケプラー第三法則: 角速度 ∝ a^-1.5（内側ほど速い）。上限クランプ。rad/秒。 */
export function orbitalAngularSpeed(semiMajorAxisAu: number): number {
  return Math.min(ANIM_K * Math.pow(semiMajorAxisAu, -1.5), ANIM_MAX_OMEGA);
}

/** 時刻 t 秒での軌道位相 = planetPhase + ω(a)·t */
export function animatedPhase(
  starIndex: number, planetIndex: number, semiMajorAxisAu: number, t: number,
): number {
  return planetPhase(starIndex, planetIndex) + orbitalAngularSpeed(semiMajorAxisAu) * t;
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/system/orbit.test.ts` → PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/system/orbit.ts tests/system/orbit.test.ts
git -c commit.gpgsign=false commit -m "feat: add orbitalAngularSpeed + animatedPhase (Kepler-relative orbit animation)"
```

---

### Task 2: pickPlanet に時間 t（後方互換）

**Files:**
- Modify: `src/system/planetPick.ts`
- Test: `tests/system/planetPick.test.ts`（追記）

**Interfaces:**
- Consumes: `orbitPosition`, `animatedPhase`（Task 1）; `StellarSystem`（types）
- Produces: `pickPlanet(cameraPos: [number,number,number], rayDir: [number,number,number], system: StellarSystem, maxAngleRad: number, t?: number): number | null`（`t` 既定 0 → 静的＝従来挙動）

> **ゾーン区分:** 「t で選択位置が進む」は TDD 厳密。既定 t=0 で従来テストが不変で通ること。

- [ ] **Step 1: 失敗テストを追記** — `tests/system/planetPick.test.ts` に以下を追加（`orbitPosition`, `animatedPhase` を import に追加）

```ts
import { orbitPosition, animatedPhase } from '../../src/system/orbit';
import type { StellarSystem } from '../../src/system/types';

function oneePlanetSystem(): StellarSystem {
  return {
    starIndex: 0, starName: 'x', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
    planets: [{
      name: 'p', type: 'rock', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1,
      eqTempK: null, inHabitableZone: false, isReal: true, estimated: false,
    }],
  };
}

describe('pickPlanet time t', () => {
  it('picks based on the time-advanced position', () => {
    const sys = oneePlanetSystem();
    const T = 5;
    const posT = orbitPosition(1, animatedPhase(0, 0, 1, T)); // 惑星の t=T 位置
    // t=T で t=T 位置を狙う → 当たる
    expect(pickPlanet([0, 0, 0], posT, sys, 0.05, T)).toBe(0);
    // t=0 では惑星は別位置（ω·T ≈ 2.6rad 動く）→ 同じ光線は外れる
    expect(pickPlanet([0, 0, 0], posT, sys, 0.05, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/planetPick.test.ts`
Expected: FAIL（`pickPlanet` が 5 引数 `t` を受けない）

- [ ] **Step 3: 実装** — `src/system/planetPick.ts` を差し替え

```ts
import type { StellarSystem } from './types';
import { orbitPosition, animatedPhase } from './orbit';

export function pickPlanet(
  cameraPos: [number, number, number],
  rayDir: [number, number, number],
  system: StellarSystem,
  maxAngleRad: number,
  t = 0,
): number | null {
  const rlen = Math.hypot(rayDir[0], rayDir[1], rayDir[2]) || 1;
  const rx = rayDir[0] / rlen, ry = rayDir[1] / rlen, rz = rayDir[2] / rlen;
  let bestDot = Math.cos(maxAngleRad);
  let best: number | null = null;
  system.planets.forEach((p, i) => {
    const [px, py, pz] = orbitPosition(p.semiMajorAxisAu, animatedPhase(system.starIndex, i, p.semiMajorAxisAu, t));
    const dx = px - cameraPos[0], dy = py - cameraPos[1], dz = pz - cameraPos[2];
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return;
    const dot = (dx * rx + dy * ry + dz * rz) / len;
    if (dot >= bestDot) { bestDot = dot; best = i; }
  });
  return best;
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/system/planetPick.test.ts` → PASS（新規 + 既存テストが t 既定 0 で不変）
Run: `npx vitest run` → 全テスト PASS（app.ts の既存 4 引数呼びは t 既定 0 で互換）
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/system/planetPick.ts tests/system/planetPick.test.ts
git -c commit.gpgsign=false commit -m "feat: pickPlanet accepts optional time t (animated positions, default static)"
```

---

### Task 3: SystemScene.update(t)（惑星メッシュを時間で動かす）

**Files:**
- Modify: `src/system/SystemScene.ts`（`update` メソッド追加、土星の環メッシュ参照を保持、`animatedPhase` を import）
- Test: `tests/system/systemScene.test.ts`（追記）

**Interfaces:**
- Consumes: `orbitPosition`, `animatedPhase`（Task 1）; 既存 `planetMeshes: THREE.Mesh[]`
- Produces: `SystemScene.update(t: number): void`

> **ゾーン区分:** 「update(t) で惑星メッシュ位置が変化」は TDD 厳密。移動量の具体値は assert しない。

- [ ] **Step 1: 失敗テストを追記** — `tests/system/systemScene.test.ts` に追加（`StellarSystem` 型は既存 import を利用）

```ts
  it('update(t) advances planet mesh positions', () => {
    const sys: StellarSystem = {
      starIndex: 0, starName: 'x', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
      planets: [{
        name: 'p', type: 'rock', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1,
        eqTempK: null, inHabitableZone: false, isReal: true, estimated: false,
      }],
    };
    const scene = new SystemScene(sys);
    const before = scene.planetMeshes[0]!.position.clone();
    scene.update(5);
    expect(scene.planetMeshes[0]!.position.distanceTo(before)).toBeGreaterThan(0);
    scene.dispose();
  });
```

（`import type { StellarSystem } from '../../src/system/types';` が無ければ追加。`THREE` は既存 import を利用。）

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/systemScene.test.ts`
Expected: FAIL（`update` 未定義）

- [ ] **Step 3: 実装** — `src/system/SystemScene.ts`

先頭 import に `animatedPhase` を追加（既存 `import { orbitPosition, planetPhase } from './orbit';` を `import { orbitPosition, planetPhase, animatedPhase } from './orbit';` に）。

クラスのフィールドに土星の環参照を追加（`planetMeshes` の近く）:

```ts
  private readonly ringMeshes = new Map<number, THREE.Mesh>();
```

`p.hasRing` の環メッシュ生成ブロック内、`this.root.add(planetRing);` の直前に追加:

```ts
        this.ringMeshes.set(i, planetRing);
```

`dispose()` の前に `update` メソッドを追加:

```ts
  update(t: number): void {
    this.system.planets.forEach((p, i) => {
      const [x, y, z] = orbitPosition(
        p.semiMajorAxisAu,
        animatedPhase(this.system.starIndex, i, p.semiMajorAxisAu, t),
      );
      this.planetMeshes[i]!.position.set(x, y, z);
      this.ringMeshes.get(i)?.position.set(x, y, z);
    });
  }
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/system/systemScene.test.ts` → PASS
Run: `npx vitest run` → 全テスト PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/system/SystemScene.ts tests/system/systemScene.test.ts
git -c commit.gpgsign=false commit -m "feat: add SystemScene.update(t) to animate planet (and ring) positions"
```

---

### Task 4: app.ts 結線（時間累積・アニメ・ラベル/クリック追従）— 描画タスク

**Files:**
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `SystemScene.update`（Task 3）; `pickPlanet(..., t)`（Task 2）; `animatedPhase`（Task 1）; 既存 `orbitPosition`
- Produces: なし（結線）。**単体テストなし** — 描画タスクのためコントローラが Playwright E2E で検証（Step 6）。

> **ゾーン区分:** 結線（毎フレーム update・ラベル/クリックが同じ animT を使う）は E2E で検証。時間スケールの見え方は実機調整。

- [ ] **Step 1: import 調整** — `src/app.ts`

`import { orbitPosition, planetPhase } from './system/orbit';` を、`planetPhase` を使わなくなるので次に変更:

```ts
import { orbitPosition, animatedPhase } from './system/orbit';
```

（他に `planetPhase` を使う箇所が app.ts に無いことを確認。ラベルの惑星位相のみで使用しているはず。）

- [ ] **Step 2: 経過時間 animT を追加**

`let last = performance.now();` の近くに:

```ts
  let animT = 0;
```

`frame(now)` 内、`const dt = Math.min((now - last) / 1000, 0.1); last = now;` の直後に:

```ts
    animT += dt;
```

- [ ] **Step 3: 毎フレーム systemScene.update**

frame ループの `if (systemScene) {` ブロック（フェード処理をしている箇所）の中の先頭に追加:

```ts
      systemScene.update(animT);
```

- [ ] **Step 4: ラベルを現在位置（animatedPhase）に**

frame ループのラベル構築、惑星ループ:
```ts
      currentSystem.planets.forEach((p, i) => {
        const phase = planetPhase(currentSystem.starIndex, i);
        const [px, py, pz] = orbitPosition(p.semiMajorAxisAu, phase);
```
を次に置換（`animatedPhase(animT)` で現在位置に）:
```ts
      currentSystem.planets.forEach((p, i) => {
        const [px, py, pz] = orbitPosition(
          p.semiMajorAxisAu,
          animatedPhase(currentSystem.starIndex, i, p.semiMajorAxisAu, animT),
        );
```
（`if (isSolar) { ... } else { ... }` の中身は不変。`worldPos: [px, py, pz]` は現在位置になる。）

- [ ] **Step 5: クリックに animT を渡す**

pointerup ハンドラの惑星ピック:
```ts
      const pIdx = pickPlanet([camAu.x, camAu.y, camAu.z], rayDir, currentSystem, PLANET_PICK_ANGLE);
```
を次に置換:
```ts
      const pIdx = pickPlanet([camAu.x, camAu.y, camAu.z], rayDir, currentSystem, PLANET_PICK_ANGLE, animT);
```

- [ ] **Step 6: 型・ビルド・全テスト**

Run: `npx tsc --noEmit` → エラーなし
Run: `npx vitest run` → 全テスト PASS
Run: `npm run build # CLAUDE_AUDIT_OK` → 成功

- [ ] **Step 7: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/app.ts
git -c commit.gpgsign=false commit -m "feat: animate planet orbits (per-frame update, labels + picking follow)"
```

- [ ] **Step 8: コントローラが Playwright E2E で受入基準を検証**

`npm run dev`（→ `http://localhost:5181`）で:
1. 太陽系ビューで惑星が軌道に沿って公転（内惑星ほど速く、外惑星はゆっくり）。太陽は中心に静止。
2. 動く惑星に名前/公転/自転ラベルが追従。土星の環が土星と一緒に動く。
3. 動く惑星をクリックで選択でき、正しい惑星の詳細パネルが出る。
4. 別の星（手続き系）に突入しても惑星が公転。軌道リングは静止・既存表示不変。

**描画タスクのため、Step 8 の E2E が通るまで Task 4 は未完。** 時間スケールは live-tune で調整。

---

## Self-Review（記入済み — spec との照合）

**Spec coverage:**
- 公転角速度 ω∝a^-1.5 + クランプ, animatedPhase → Task 1 ✅
- クリック追従（位置ベース/時間 t）→ Task 2 ✅
- 惑星メッシュを時間で動かす（土星の環も）→ Task 3 ✅
- app 結線（animT・update・ラベル/クリックが同じ animT）+ 全恒星系適用 → Task 4 ✅
- 受入基準 1〜4 → Task 4 Step 8 ✅

**Placeholder scan:** 各コード step に完全コードあり。曖昧語なし。

**Type consistency:** `orbitalAngularSpeed(a)`/`animatedPhase(starIndex, planetIndex, a, t)` は Task 1 定義 → Task 2/3/4 消費で一致。`pickPlanet(..., t?=0)` は Task 2 定義 → Task 4 消費で一致。`SystemScene.update(t)` は Task 3 定義 → Task 4 消費で一致。`planetPhase` は app.ts から除去し `animatedPhase` に置換（import 整合）。

**未解決の実装時判断（実装者が現物で確定）:** app.ts の該当ブロックは現行行（solar-detail/localgroup 結線後）に合わせて置換。`systemScene.update` は `if (systemScene)` ガード内で呼ぶので null 安全。
