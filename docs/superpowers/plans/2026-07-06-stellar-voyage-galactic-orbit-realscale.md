# 太陽の銀河公転を実スケールで（銀河ビュー）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 太陽系ビューの模式的な銀河公転円（実スケールではない）を撤去し、銀河（天の川）ビューで太陽の公転軌道を実比率の円で描き、天の川をゆっくり自転させる。太陽（現在地）は中心固定。

**Architecture:** Part A=`SystemScene`/`app.ts` から太陽の金色円・道標・系トラベルを削除し `galacticPath.ts` を削除。Part B=`LocalGroup` に公転軌道円と `update(t)` 自転を追加、`app.ts` が毎フレーム `localGroup.update(animT)` と軌道ラベルを結線。

**Tech Stack:** TypeScript (strict + noUncheckedIndexedAccess), Three.js, Vitest (jsdom), Vite。

## Global Constraints

- ユーザー向け文言は日本語。ワールド単位 AU。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。テストは `tests/` 配下、`import ... from '../../src/...'`。
- コミット末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。署名エラー時 `git -c commit.gpgsign=false commit`。`--no-verify` 禁止。
- ビルド系は監査 hook。テスト済み・隔離済みなら末尾に `# CLAUDE_AUDIT_OK`（Task 3 のみ build 確認）。

## 実装ポリシー: TDD 厳密ゾーン と 実機調整ゾーン（サブエージェント必読）

- **◆ TDD 厳密ゾーン**: 構造不変=太陽系ビューに金色公転円(`THREE.Line`)/道標が無い・`galMarkers` フィールド無し、`LocalGroup` に軌道円メッシュが在る・`update(t)` で天の川の回転が変化・`galacticCenterWorldPos()` が原点でない。
- **◆ 実機調整ゾーン（テストで固定しない）**: `GALAXY_SPIN_SPEED`・自転の軸/order の見え方・軌道円の色/太さ・ラベル位置。**具体値/座標を assert しない**（有無・変化・非原点のみ）。

## File Structure

```
src/system/SystemScene.ts        # 改修: 金色円/道標/setTravelAngle 削除・太陽静止（travelGroup は原点で残す）
src/app.ts                       # 改修: 太陽トラベル結線削除・太陽ラベル復帰 / localGroup.update+銀河公転ラベル
src/galaxy/LocalGroup.ts         # 改修: 太陽公転軌道円 + update(t) 自転 + galacticCenterWorldPos
（削除）src/system/galacticPath.ts, tests/system/galacticPath.test.ts
tests/system/systemScene.test.ts # 改修: 道標/travel テスト削除・金色円が無いことを確認
tests/galaxy/localGroup.test.ts  # 追加/改修: 軌道円メッシュ在り・update(t) で天の川回転が変化
```

**タスク順（依存）:** 1 Part A リバート（SystemScene/app.ts/galacticPath 削除）→ 2 LocalGroup 軌道円+自転（独立）→ 3 app.ts Part B 結線（1,2 に依存, 描画=コントローラ E2E）。

---

### Task 1: Part A — 太陽系ビューの模式円・道標・系トラベルを撤去

**Files:**
- Modify: `src/system/SystemScene.ts`, `src/app.ts`
- Delete: `src/system/galacticPath.ts`, `tests/system/galacticPath.test.ts`
- Test: `tests/system/systemScene.test.ts`（改修）

**Interfaces:**
- Produces: なし（撤去）。`SystemScene` は `planetWorldPos`/`sunWorldPos`/`update(t)`（惑星公転）を維持、`galMarkers`/`setTravelAngle` を除去。

> **ゾーン区分:** 「金色公転円/道標が無い」構造は TDD 厳密。太陽が静止・惑星が動くのは既存テスト+E2E。

- [ ] **Step 1: systemScene.test.ts を改修（先に失敗させる）** — `tests/system/systemScene.test.ts`

削除するテスト: `describe('SystemScene galactic-path markers', ...)` ブロック全体（markers length / non-solar no markers）と `describe('SystemScene travel ...')` ブロック全体（`setTravelAngle` を使うもの）。それらが import していた `GAL_MARKER_COUNT`（`../../src/system/galacticPath` からの import）も削除。

追加するテスト（金色円が無いことを確認）— 既存の `describe('SystemScene', ...)` 内に:
```ts
  it('solar system has no galactic-orbit circle line (moved to galaxy view)', () => {
    const scene = new SystemScene(system);
    let hasLine = false;
    scene.root.traverse((o) => { if (o instanceof THREE.Line) hasLine = true; });
    expect(hasLine).toBe(false);
    scene.dispose();
  });
```
（`system` は同ファイル既存のテスト用 system。`THREE` は import 済み。）

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/systemScene.test.ts`
Expected: 新テストが FAIL（現状は金色円 Line が在る）／削除したテストは消えている

- [ ] **Step 3: SystemScene を改修** — `src/system/SystemScene.ts`

- 先頭の `import { galacticPathPoint, GAL_MARKER_COUNT } from './galacticPath';` を**削除**。
- `readonly galMarkers: THREE.Mesh[] = [];` フィールドを**削除**。
- コンストラクタの `if (system.starIndex === 0) { ... }` ブロック（金色 orbitLine + markerGroup/道標生成）を**丸ごと削除**。
- `setTravelAngle(angle: number): void { ... }` メソッドを**削除**。
- `travelGroup`・`_scratch`・`planetWorldPos`・`sunWorldPos`・`update(t)`（惑星ループ）・`dispose()` は**維持**（`update(t)` からトラベル分岐は既に無い＝惑星公転のみ）。

- [ ] **Step 4: app.ts を改修** — `src/app.ts`

- `import { SYSTEM_TRAVEL_SPEED } from './system/galacticPath';` を**削除**。
- frame 内の太陽トラベル結線（`systemScene.update(animT);` の直後）:
```ts
      const inSolarView = currentSystem.starIndex === 0 && fade > 0.5;
      systemScene.setTravelAngle(inSolarView ? animT * SYSTEM_TRAVEL_SPEED : 0);
```
を**削除**（`systemScene.update(animT);` は残す）。
- 太陽ラベル文言を復帰:
```ts
          text: `太陽 ・ 銀河を ${SUN_FACTS.galacticSpeedKmS}km/s で移動中（クリックで詳細）`,
```
を次に置換:
```ts
          text: `太陽 ・ 公転 ${SUN_FACTS.galacticSpeedKmS}km/s（クリックで詳細）`,
```
（`worldPos: ss.sunWorldPos()` は不変。PauseButton・`if(!paused) animT+=dt` は不変。）

- [ ] **Step 5: galacticPath を削除**

```bash
git rm src/system/galacticPath.ts tests/system/galacticPath.test.ts
```

- [ ] **Step 6: 型・全テスト**

Run: `npx tsc --noEmit` → エラーなし（galacticPath 参照が残っていれば失敗＝全て除去）
Run: `npx vitest run tests/system/systemScene.test.ts` → PASS（新「Line 無し」含む）
Run: `npx vitest run` → 全テスト PASS

- [ ] **Step 7: コミット**（末尾に Co-Authored-By trailer）

```bash
git add -A
git -c commit.gpgsign=false commit -m "revert: remove solar-view symbolic galactic-orbit circle/markers/travel; delete galacticPath"
```

---

### Task 2: Part B — LocalGroup に太陽公転軌道円 + 天の川自転

**Files:**
- Modify: `src/galaxy/LocalGroup.ts`
- Test: `tests/galaxy/localGroup.test.ts`（無ければ新規作成、有れば追記）

**Interfaces:**
- Produces: `LocalGroup.update(t: number): void`（天の川を面内自転）, `LocalGroup.galacticCenterWorldPos(): [number,number,number]`。太陽公転軌道円（`THREE.Line`）を group に追加。

> **ゾーン区分:** 「軌道円メッシュ在り・update(t) で回転が変化・galacticCenterWorldPos が非原点」は TDD 厳密。自転速度・軸/order・色は実機調整。

- [ ] **Step 1: 失敗テストを作成/追記** — `tests/galaxy/localGroup.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LocalGroup } from '../../src/galaxy/LocalGroup';

describe('LocalGroup galactic orbit', () => {
  it('has a Sun galactic-orbit circle line', () => {
    const lg = new LocalGroup();
    let lines = 0;
    lg.object.traverse((o) => { if (o instanceof THREE.Line) lines++; });
    expect(lines).toBeGreaterThan(0);
    lg.dispose();
  });
  it('update(t) rotates the Milky Way disk (galaxy spin)', () => {
    const lg = new LocalGroup();
    lg.update(0);
    const r0 = (lg.object.children[0] as THREE.Object3D).rotation.y; // children[0] = 天の川円盤
    lg.update(5);
    const r5 = (lg.object.children[0] as THREE.Object3D).rotation.y;
    expect(r5).not.toBe(r0);
    lg.dispose();
  });
  it('galacticCenterWorldPos is offset from the origin (Sun)', () => {
    const lg = new LocalGroup();
    const c = lg.galacticCenterWorldPos();
    expect(Math.hypot(c[0], c[1], c[2])).toBeGreaterThan(0);
    lg.dispose();
  });
});
```
（`tests/galaxy/` が無ければ作成。既存 localGroup テストがあれば、この describe を追記。）

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/galaxy/localGroup.test.ts`
Expected: FAIL（軌道円 Line 無し・`update`/`galacticCenterWorldPos` 未定義）

- [ ] **Step 3: 実装** — `src/galaxy/LocalGroup.ts`

`GALAXY_SPIN_SPEED` 定数を追加（`SUN_DISK_OFFSET` の近く）:
```ts
const GALAXY_SPIN_SPEED = 0.1; // 天の川の面内自転速度 rad/秒（実機調整）
```

フィールド追加（`marker` の近く）:
```ts
  private readonly orbitLine: THREE.Line;
```

コンストラクタ: 天の川の Euler order を面内自転優先にする（`this.milkyWay.object.rotation.x = 0.5;` の**前**に）:
```ts
    this.milkyWay.object.rotation.order = 'YXZ';
```

コンストラクタ末尾（marker 追加の後）に軌道円を追加:
```ts
    // 太陽の銀河公転軌道（実比率）: 銀河中心を中心・半径 SUN_DISK_OFFSET・天の川面内。太陽=原点はこの円上(a=0)。
    const orbitPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      orbitPts.push(new THREE.Vector3(SUN_DISK_OFFSET * Math.cos(a), 0, SUN_DISK_OFFSET * Math.sin(a)));
    }
    this.orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPts),
      new THREE.LineBasicMaterial({ color: 0xffd479, transparent: true, opacity: 0.5 }),
    );
    this.orbitLine.position.set(-SUN_DISK_OFFSET, 0, 0);
    this.orbitLine.rotation.x = 0.5;
    this.object.add(this.orbitLine);
```

メソッド追加（`markerWorldPos` の近く）:
```ts
  update(t: number): void {
    this.milkyWay.object.rotation.y = GALAXY_SPIN_SPEED * t;
  }

  galacticCenterWorldPos(): [number, number, number] {
    this.object.updateWorldMatrix(true, true);
    this.milkyWay.object.getWorldPosition(_scratchA);
    return [_scratchA.x, _scratchA.y, _scratchA.z];
  }
```

`setOpacity(o)` に追加:
```ts
    (this.orbitLine.material as THREE.LineBasicMaterial).opacity = o;
```

`dispose()` に追加:
```ts
    this.orbitLine.geometry.dispose();
    (this.orbitLine.material as THREE.Material).dispose();
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/galaxy/localGroup.test.ts` → PASS
Run: `npx vitest run` → 全テスト PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/galaxy/LocalGroup.ts tests/galaxy/localGroup.test.ts
git -c commit.gpgsign=false commit -m "feat: LocalGroup Sun galactic-orbit circle + Milky Way spin (update)"
```

---

### Task 3: Part B 結線（app.ts で自転駆動 + 銀河公転ラベル）— 描画タスク

**Files:**
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `LocalGroup.update`, `LocalGroup.galacticCenterWorldPos`（Task 2）; `SUN_FACTS`（既存 import）
- Produces: なし（結線）。**単体テストなし** — 描画タスクのためコントローラが Playwright E2E で検証（Step 4）。

> **ゾーン区分:** 結線（自転駆動・ラベル）は E2E で検証。自転速度・ラベル位置は実機調整。

- [ ] **Step 1: localGroup.update を毎フレーム呼ぶ** — `src/app.ts`

frame 内、`localGroup.setPosition(-nav.focusWorldAu[0], -nav.focusWorldAu[1], -nav.focusWorldAu[2]);` の**直後**に追加:
```ts
    localGroup.update(animT);
```
（`animT` 駆動＝停止ボタンで銀河自転も止まる。`animT` はこの時点で加算済み。）

- [ ] **Step 2: 銀河公転ラベルを追加** — `src/app.ts`

局部銀河群ラベルの push 箇所（現状）:
```ts
      labelItems.push({ text: '現在地（太陽系）', worldPos: localGroup.markerWorldPos() });
      labelItems.push({ text: '約250万光年', worldPos: localGroup.midpointWorldPos() });
```
の**直後**に追加:
```ts
      labelItems.push({
        text: `太陽の銀河公転 ・ 約${(SUN_FACTS.galacticPeriodYr / 1e8).toPrecision(2)}億年で1周（半径約${(SUN_FACTS.galacticCenterLy / 1e4).toFixed(1)}万光年）`,
        worldPos: localGroup.galacticCenterWorldPos(),
      });
```
（`SUN_FACTS` は app.ts で import 済み。`galacticPeriodYr`=2.3e8→「2.3」, `galacticCenterLy`=26000→「2.6」。）

- [ ] **Step 3: 型・ビルド・全テスト**

Run: `npx tsc --noEmit` → エラーなし
Run: `npx vitest run` → 全テスト PASS
Run: `npm run build # CLAUDE_AUDIT_OK` → 成功

- [ ] **Step 4: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/app.ts
git -c commit.gpgsign=false commit -m "feat: drive Milky Way spin + galactic-orbit label in galaxy view"
```

- [ ] **Step 5: コントローラが Playwright E2E で受入基準を検証**

`npm run dev`（→ `http://localhost:5181`）で:
1. 太陽系ビュー: 金色の公転円・道標が**無い**・太陽は中心静止・惑星の公転アニメは動く・停止ボタンで惑星停止&クリック可・太陽ラベル「太陽 ・ 公転 220km/s（クリックで詳細）」。
2. 銀河ビュー（ズームアウトで天の川）: 太陽の**公転軌道円**が天の川内に実比率で描かれ、太陽(現在地)が円上・中心固定。**天の川がゆっくり自転**（腕が回る）。ラベル「太陽の銀河公転 ・ 約2.3億年で1周（半径約2.6万光年）」。
3. 停止ボタンで銀河の自転も止まる。
4. 既存（天の川/アンドロメダ/現在地/約250万光年・クロスフェード）不変。

**描画タスクのため、Step 5 の E2E が通るまで Task 3 は未完。** 自転速度・軌道円の見た目・ラベル位置は live-tune。

---

## Self-Review（記入済み — spec との照合）

**Spec coverage:**
- Part A 撤去（SystemScene 金色円/道標/setTravelAngle・app トラベル結線・galacticPath 削除・太陽ラベル復帰）→ Task 1 ✅
- Part B LocalGroup 軌道円 + update(t) 自転 + galacticCenterWorldPos → Task 2 ✅
- Part B app 結線（localGroup.update(animT) + 銀河公転ラベル）→ Task 3 ✅
- 受入基準 1〜4 → Task 3 Step 5 ✅

**Placeholder scan:** 各 step に完全コード/コマンドあり。曖昧語なし。

**Type consistency:** `LocalGroup.update(t)`/`galacticCenterWorldPos()`（Task 2）→ Task 3 app.ts 消費で一致。`galMarkers`/`setTravelAngle`/`SYSTEM_TRAVEL_SPEED`/`galacticPath` は Task 1 で完全除去（app.ts/SystemScene/tests から）。`SUN_FACTS.galacticPeriodYr`/`galacticCenterLy` は既存フィールド。

**未解決の実装時判断（実装者が現物で確定）:** app.ts の行番号は現行に合わせ内容一致で置換。`tests/galaxy/localGroup.test.ts` の有無を確認（無ければ作成）。天の川自転の軸/order は E2E で「腕が面内で回る」ことを確認し必要なら調整（コントローラ）。`travelGroup` は原点で残し `planetWorldPos`/`sunWorldPos` の world 位置結線は不変。
