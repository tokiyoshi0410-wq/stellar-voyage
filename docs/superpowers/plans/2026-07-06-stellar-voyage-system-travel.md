# 太陽系ごと銀河の道を旅する（system travel）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 太陽系全体（太陽＋惑星＋軌道）が金の銀河公転の道に沿って画面内を進む（端で画面外ループ・中心も通る）。惑星は動く太陽を公転（螺旋）。ラベル/クリックはワールド座標で移動する系に追従。一時停止（既存）で全凍結。solar のみ。

**Architecture:** 太陽・惑星・軌道リング・PointLight を新設 `travelGroup`（root の子）に収容し、`update(t)` で `travelGroup.position = galacticPathPoint(systemTravelParam(t))` で道を進める。金の道・固定道標は root 直下（不動）。ラベル/クリック/太陽クリックは `planetWorldPos(i)`/`sunWorldPos()`（getWorldPosition）を使う。`pickPlanet` はワールド座標配列を受け取る形へ。

**Tech Stack:** TypeScript (strict + noUncheckedIndexedAccess), Three.js, Vitest (jsdom), Vite。

## Global Constraints

- ユーザー向け文言は日本語。ワールド単位 AU。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。テストは `tests/` 配下、`import ... from '../../src/...'`。vitest 既定環境 jsdom。
- コミット末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。署名エラー時 `git -c commit.gpgsign=false commit`。`--no-verify` 禁止。
- ビルド系は監査 hook。テスト済み・隔離済みなら末尾に `# CLAUDE_AUDIT_OK`（Task 3 のみ build 確認）。

## 実装ポリシー: TDD 厳密ゾーン と 実機調整ゾーン（サブエージェント必読）

- **◆ TDD 厳密ゾーン**: `systemTravelParam`（t=0=中心0・進行方向・範囲 [-π/3,π/3]・ループ周期）、`SystemScene.update(t)` で `sunWorldPos()`/`planetWorldPos(0)` が動く・道標固定・非solar は太陽が原点、`pickPlanet`（ワールド座標配列でレイ最近選択）。
- **◆ 実機調整ゾーン（テストで固定しない）**: `SYSTEM_TRAVEL_SPEED`・進む範囲・道標の見え方・傾き。**具体座標/秒数を assert しない**（中心=0・単調・範囲・周期・「動いた>0」のみ）。

## File Structure

```
src/system/galacticPath.ts       # 追加: systemTravelParam, SYSTEM_TRAVEL_SPEED
src/system/SystemScene.ts        # 改修: travelGroup 収容・道標固定・傾き廃止・update で travel・world 位置公開
src/system/planetPick.ts         # 改修: ワールド座標配列で選択（system/t 廃止）
src/app.ts                       # 改修: ラベル/クリック/太陽クリックを world 位置ベースに
tests/system/galacticPath.test.ts   # 追記: systemTravelParam
tests/system/systemScene.test.ts    # 追記: travel/world 位置/道標固定/非solar
tests/system/planetPick.test.ts     # 改修: ワールド座標配列シグネチャ
```

**タスク順（依存）:** 1 systemTravelParam（独立）→ 2 SystemScene travelGroup（1 に依存）→ 3 pickPlanet 世界座標化 + app.ts 全結線（1,2 に依存, 描画=コントローラ E2E）。

---

### Task 1: galacticPath に systemTravelParam（純関数）

**Files:**
- Modify: `src/system/galacticPath.ts`（末尾に追加）
- Test: `tests/system/galacticPath.test.ts`（追記）

**Interfaces:**
- Consumes: `GAL_ARC_SPAN`（既存, 同ファイル）
- Produces: `SYSTEM_TRAVEL_SPEED: number`, `systemTravelParam(t: number, speed: number): number`

> **ゾーン区分:** 中心0・進行方向・範囲・周期は TDD 厳密。`SYSTEM_TRAVEL_SPEED` の値は実機調整（値そのものを assert しない）。

- [ ] **Step 1: 失敗テストを追記** — `tests/system/galacticPath.test.ts`（既存 import に `systemTravelParam` を追加。`GAL_ARC_SPAN` は既存 import 済）

```ts
describe('systemTravelParam', () => {
  it('starts centered (0) at t=0', () => {
    expect(systemTravelParam(0, 0.05)).toBeCloseTo(0, 9);
  });
  it('stays within [-π/3, π/3]', () => {
    for (const t of [0, 1, 5, 13, 40, 100]) {
      const p = systemTravelParam(t, 0.05);
      expect(p).toBeGreaterThanOrEqual(-Math.PI / 3 - 1e-9);
      expect(p).toBeLessThanOrEqual(Math.PI / 3 + 1e-9);
    }
  });
  it('moves toward -π/3 as t increases (before wrap)', () => {
    expect(systemTravelParam(1, 0.05)).toBeLessThan(systemTravelParam(0, 0.05));
  });
  it('loops with period GAL_ARC_SPAN / speed', () => {
    const period = GAL_ARC_SPAN / 0.05;
    expect(systemTravelParam(2 + period, 0.05)).toBeCloseTo(systemTravelParam(2, 0.05), 9);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/galacticPath.test.ts`
Expected: FAIL（`systemTravelParam` 未定義）

- [ ] **Step 3: 実装** — `src/system/galacticPath.ts` の末尾に追加

```ts
export const SYSTEM_TRAVEL_SPEED = 0.05; // rad/秒（実機調整・ゆっくり旅する）

/**
 * 太陽系が金の道を進む弧パラメータ。t=0 で 0（中心）、時間とともに -π/3 へ進み、
 * +π/3 側から再入してループ（画面外で折返し・中心を周期的に通る）。範囲 [-π/3, π/3]。
 */
export function systemTravelParam(t: number, speed: number): number {
  const raw = (((t * speed + Math.PI / 3) % GAL_ARC_SPAN) + GAL_ARC_SPAN) % GAL_ARC_SPAN; // [0, SPAN)
  return Math.PI / 3 - raw; // t=0 → 0（中心）; 増加で -π/3 へ, ラップで +π/3 から
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/system/galacticPath.test.ts` → PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/system/galacticPath.ts tests/system/galacticPath.test.ts
git -c commit.gpgsign=false commit -m "feat: add systemTravelParam (whole-system travel along galactic path)"
```

---

### Task 2: SystemScene を travelGroup 化して道を旅させる

**Files:**
- Modify: `src/system/SystemScene.ts`
- Test: `tests/system/systemScene.test.ts`（追記）

**Interfaces:**
- Consumes: `galacticPathPoint`, `systemTravelParam`, `SYSTEM_TRAVEL_SPEED`（Task 1/既存）
- Produces: `SystemScene.planetWorldPos(i: number): [number, number, number]`, `SystemScene.sunWorldPos(): [number, number, number]`。`update(t)` が solar で系全体を道に沿って動かす。

> **ゾーン区分:** 「solar で update(t) 後に太陽/惑星の world 位置が動く・道標固定・非solar は太陽原点」は TDD 厳密。旅速度・傾き・見え方は実機調整。

- [ ] **Step 1: 失敗テストを追記** — `tests/system/systemScene.test.ts`（`systemTravelParam` 不要。`GAL_MARKER_COUNT` は既存 import 済、`StellarSystem` も）

```ts
  it('solar: update(t) travels the whole system (sun + planet world pos move), markers stay fixed', () => {
    const sys: StellarSystem = {
      starIndex: 0, starName: '太陽', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
      planets: [{
        name: 'p', type: 'rock', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1,
        eqTempK: null, inHabitableZone: false, isReal: true, estimated: false,
      }],
    };
    const scene = new SystemScene(sys);
    const sun0 = scene.sunWorldPos();
    const p0 = scene.planetWorldPos(0);
    const marker0 = scene.galMarkers[0]!.position.clone();
    scene.update(3);
    const sun3 = scene.sunWorldPos();
    const p3 = scene.planetWorldPos(0);
    expect(Math.hypot(sun3[0]-sun0[0], sun3[1]-sun0[1], sun3[2]-sun0[2])).toBeGreaterThan(0);
    expect(Math.hypot(p3[0]-p0[0], p3[1]-p0[1], p3[2]-p0[2])).toBeGreaterThan(0);
    expect(scene.galMarkers[0]!.position.distanceTo(marker0)).toBe(0);
    scene.dispose();
  });
  it('non-solar: sun stays at origin (no travel)', () => {
    const sys: StellarSystem = {
      starIndex: 5, starName: 'x', spectralClass: 'K', temperatureK: 4000, luminositySun: 0.3,
      planets: [],
    };
    const scene = new SystemScene(sys);
    scene.update(3);
    const sun = scene.sunWorldPos();
    expect(Math.hypot(sun[0], sun[1], sun[2])).toBe(0);
    scene.dispose();
  });
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/systemScene.test.ts`
Expected: FAIL（`sunWorldPos`/`planetWorldPos` 未定義）

- [ ] **Step 3: 実装** — `src/system/SystemScene.ts`

先頭 import に追加（既存の galacticPath import 行に追記）:
```ts
import {
  galacticPathPoint, galacticMarkerParam, GAL_ARC_SPAN, GAL_MARKER_COUNT, GAL_FLOW_SPEED,
  systemTravelParam, SYSTEM_TRAVEL_SPEED,
} from './galacticPath';
```

フィールド追加（`ringMeshes` の近く）:
```ts
  private readonly travelGroup = new THREE.Group();
  private readonly _scratch = new THREE.Vector3();
```

コンストラクタ先頭付近で travelGroup を root に追加（星を作る前に）:
```ts
    this.root.add(this.travelGroup);
```

**太陽・惑星・軌道リング・土星の環・PointLight の add 先を root → travelGroup に変更**:
- 星: `this.root.add(star);` → `this.travelGroup.add(star);`
- 惑星: `this.root.add(mesh);` → `this.travelGroup.add(mesh);`
- 軌道リング: `this.root.add(ring);` → `this.travelGroup.add(ring);`
- 土星の環: `this.root.add(planetRing);` → `this.travelGroup.add(planetRing);`
- PointLight: `this.root.add(new THREE.PointLight(...));` → `this.travelGroup.add(new THREE.PointLight(...));`

**金の道・道標は root のまま・傾き廃止（flat）**:
- `orbitLine.rotation.x = 0.35;` の行を**削除**（金の道は flat）。`this.root.add(orbitLine);` は維持。
- `markerGroup.rotation.x = 0.35;` の行を**削除**（道標も flat）。`this.root.add(markerGroup);` は維持。道標は構築時位置のまま。

`update(t)` を次に置換（惑星ローカル公転は維持・道標 flow を削除・solar 旅を追加）:
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
    if (this.system.starIndex === 0) {
      const [tx, ty, tz] = galacticPathPoint(systemTravelParam(t, SYSTEM_TRAVEL_SPEED));
      this.travelGroup.position.set(tx, ty, tz);
    }
  }
```

`dispose()` の前にワールド位置メソッドを追加:
```ts
  planetWorldPos(i: number): [number, number, number] {
    this.root.updateWorldMatrix(true, true);
    this.planetMeshes[i]!.getWorldPosition(this._scratch);
    return [this._scratch.x, this._scratch.y, this._scratch.z];
  }

  sunWorldPos(): [number, number, number] {
    this.root.updateWorldMatrix(true, true);
    this.travelGroup.getWorldPosition(this._scratch);
    return [this._scratch.x, this._scratch.y, this._scratch.z];
  }
```

（注: `galacticMarkerParam`/`GAL_FLOW_SPEED` は道標の構築時初期位置算出にのみ残す。update では道標を動かさない。）

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/system/systemScene.test.ts` → PASS
Run: `npx vitest run` → 全テスト PASS（app.ts はまだ旧ラベル/ピックだが tsc/挙動は保たれる）
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/system/SystemScene.ts tests/system/systemScene.test.ts
git -c commit.gpgsign=false commit -m "feat: SystemScene travelGroup travels the galactic path (solar); expose world positions"
```

---

### Task 3: pickPlanet を世界座標化 + app.ts を移動する系に追従 — 描画タスク

**Files:**
- Modify: `src/system/planetPick.ts`
- Modify: `src/app.ts`
- Test: `tests/system/planetPick.test.ts`（内容を差し替え）

**Interfaces:**
- Consumes: `SystemScene.planetWorldPos`/`sunWorldPos`（Task 2）
- Produces: `pickPlanet(cameraPos, rayDir, positions: readonly [number,number,number][], maxAngleRad): number | null`（system/t 廃止）。**app 結線は単体テストなし** — 描画/操作タスクのためコントローラが Playwright E2E で検証（Step 7）。

> **ゾーン区分:** pickPlanet の位置ベース選択は TDD 厳密。app 結線（ラベル/クリックが移動する系に追従）は E2E で検証。

- [ ] **Step 1: pickPlanet テストを差し替え** — `tests/system/planetPick.test.ts`（ファイル内容を丸ごと以下に置換。旧 `onePlanetSystem`/`t` テストは廃止）

```ts
import { describe, it, expect } from 'vitest';
import { pickPlanet } from '../../src/system/planetPick';

describe('pickPlanet (world positions)', () => {
  it('returns the planet whose world position best matches the ray within the cone', () => {
    const positions: [number, number, number][] = [[1, 0, 0], [0, 0, 5]];
    expect(pickPlanet([0, 0, 0], [1, 0, 0], positions, 0.1)).toBe(0);
    expect(pickPlanet([0, 0, 0], [0, 0, 1], positions, 0.1)).toBe(1);
  });
  it('returns null when no planet is within the cone', () => {
    expect(pickPlanet([0, 0, 0], [0, 1, 0], [[1, 0, 0]], 0.1)).toBeNull();
  });
  it('picks the closest-to-ray planet among several', () => {
    const positions: [number, number, number][] = [[10, 0, 0], [0, 10, 0], [0, 0, 10]];
    expect(pickPlanet([0, 0, 0], [0, 1, 0.02], positions, 0.2)).toBe(1);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/planetPick.test.ts`
Expected: FAIL（旧シグネチャのため型/実行エラー）

- [ ] **Step 3: pickPlanet を実装** — `src/system/planetPick.ts` を丸ごと置換

```ts
export function pickPlanet(
  cameraPos: [number, number, number],
  rayDir: [number, number, number],
  positions: readonly [number, number, number][],
  maxAngleRad: number,
): number | null {
  const rlen = Math.hypot(rayDir[0], rayDir[1], rayDir[2]) || 1;
  const rx = rayDir[0] / rlen, ry = rayDir[1] / rlen, rz = rayDir[2] / rlen;
  let bestDot = Math.cos(maxAngleRad);
  let best: number | null = null;
  positions.forEach((pos, i) => {
    const dx = pos[0] - cameraPos[0], dy = pos[1] - cameraPos[1], dz = pos[2] - cameraPos[2];
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) return;
    const dot = (dx * rx + dy * ry + dz * rz) / len;
    if (dot >= bestDot) { bestDot = dot; best = i; }
  });
  return best;
}
```

- [ ] **Step 4: app.ts のクリック処理を world 位置ベースに** — `src/app.ts`

クリック（現行 133〜154 行付近）のブロックを次に置換（`fade > 0.5` を `fade > 0.5 && systemScene` にし、`ss` で capture・惑星は world 位置配列・太陽は world 位置方向）:

現行:
```ts
    if (fade > 0.5) {
      const pIdx = pickPlanet([camAu.x, camAu.y, camAu.z], rayDir, currentSystem, PLANET_PICK_ANGLE, animT);
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
        const camLen = Math.hypot(camAu.x, camAu.y, camAu.z) || 1;
        const sunDot = (-camAu.x * rayDir[0] - camAu.y * rayDir[1] - camAu.z * rayDir[2]) / camLen;
        if (sunDot > Math.cos(SUN_PICK_ANGLE)) {
          planetPanel.showText(sunGalacticText());
          infoPanel.hide();
          return;
        }
      }
    }
```
置換後:
```ts
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
```

- [ ] **Step 5: app.ts のラベルを world 位置ベースに** — `src/app.ts`

ラベル構築（現行 258〜283 行付近）を次に置換（`fade > 0.5` に `&& systemScene` を追加・`ss` capture・太陽/惑星の worldPos を world 位置に）:

現行:
```ts
    if (fade > 0.5) {
      const isSolar = currentSystem.starIndex === 0;
      if (isSolar) {
        labelItems.push({
          text: `太陽 ・ 銀河を ${SUN_FACTS.galacticSpeedKmS}km/s で移動中（クリックで詳細）`,
          worldPos: [0, 0, 0],
        });
      } else {
        labelItems.push({ text: starDisplayName(currentSystem.starIndex, currentSystem.starName), worldPos: [0, 0, 0] });
      }
      currentSystem.planets.forEach((p, i) => {
        const [px, py, pz] = orbitPosition(
          p.semiMajorAxisAu,
          animatedPhase(currentSystem.starIndex, i, p.semiMajorAxisAu, animT),
        );
        if (isSolar) {
```
置換後（`worldPos` のみ world 位置に。文言・km/h 表示は不変）:
```ts
    if (fade > 0.5 && systemScene) {
      const ss = systemScene;
      const isSolar = currentSystem.starIndex === 0;
      if (isSolar) {
        labelItems.push({
          text: `太陽 ・ 銀河を ${SUN_FACTS.galacticSpeedKmS}km/s で移動中（クリックで詳細）`,
          worldPos: ss.sunWorldPos(),
        });
      } else {
        labelItems.push({ text: starDisplayName(currentSystem.starIndex, currentSystem.starName), worldPos: ss.sunWorldPos() });
      }
      currentSystem.planets.forEach((p, i) => {
        const [px, py, pz] = ss.planetWorldPos(i);
        if (isSolar) {
```
（以降の `if (isSolar) { ... } else { ... }` の中身＝`worldPos: [px, py, pz]` を含めそのまま。）

- [ ] **Step 6: 未使用 import を除去 + 型・ビルド・全テスト** — `src/app.ts`

`orbitPosition`/`animatedPhase` が app.ts で未使用になったはず。`import { orbitPosition, animatedPhase } from './system/orbit';` を確認し、両方未使用なら行ごと削除（片方使用なら残す）。

Run: `npx tsc --noEmit` → エラーなし（未使用 import が残ると strict で失敗しうる）
Run: `npx vitest run` → 全テスト PASS
Run: `npm run build # CLAUDE_AUDIT_OK` → 成功

- [ ] **Step 7: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/system/planetPick.ts src/app.ts tests/system/planetPick.test.ts
git -c commit.gpgsign=false commit -m "feat: labels + picking follow the traveling solar system (world positions)"
```

- [ ] **Step 8: コントローラが Playwright E2E で受入基準を検証**

`npm run dev`（→ `http://localhost:5181`）で:
1. 太陽系全体（太陽＋惑星＋軌道）が金の道に沿って画面内を移動し中心も通る。惑星は動く太陽を公転（螺旋）。固定道標を通り過ぎる。
2. 移動中の惑星をクリックで選択でき正しいパネル。太陽をクリックで銀河公転パネル（太陽が動いても当たる）。
3. ⏸/Space で停止すると系の移動・公転が止まり、静止状態でクリックできる。▶/Space で再開。
4. 手続き系（starIndex≠0）は従来どおり中心固定・非トラベル。

**描画/操作タスクのため、Step 8 の E2E が通るまで Task 3 は未完。** 旅速度・範囲は live-tune で調整（画面内に収まるよう）。

---

## Self-Review（記入済み — spec との照合）

**Spec coverage:**
- systemTravelParam 純関数 → Task 1 ✅
- travelGroup 収容・道を旅・道標固定・傾き廃止・world 位置公開 → Task 2 ✅
- pickPlanet 世界座標化・app.ts ラベル/クリック/太陽クリックの world 追従・未使用 import 除去 → Task 3 ✅
- 受入基準 1〜4 → Task 3 Step 8 ✅

**Placeholder scan:** 各コード step に完全コードあり。曖昧語なし。

**Type consistency:** `systemTravelParam`/`SYSTEM_TRAVEL_SPEED`（Task 1）→ Task 2 消費で一致。`planetWorldPos`/`sunWorldPos`（Task 2）→ Task 3 app.ts 消費で一致。`pickPlanet(positions)`（Task 3）→ 同 Task の app.ts 呼び出しで一致（signature 変更と唯一の呼び出し元を同 Task で更新し tsc 緑維持）。`ss = systemScene` capture で strict null 安全。

**未解決の実装時判断（実装者が現物で確定）:** app.ts の行番号は現行（133/258 付近）に合わせ内容一致で置換。`orbitPosition`/`animatedPhase` の import は使用状況を grep 確認して未使用なら除去。travelGroup 移設後も `planetMeshes`/`ringMeshes` は同一参照（app.ts は mesh.position を直接読まない）。
