# 天の川 → アンドロメダ ズームクロスフェード 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 最もズームアウトした局部銀河群段の「天の川＋アンドロメダ横並び」を、ズームアウトで 天の川 → アンドロメダ へクロスフェードする演出に変える。

**Architecture:** 純粋関数 `andromedaFade(viewDistanceAu)` と合成 `localGroupOpacities(v)` を `localGroupFade.ts` に追加（TDD）。`LocalGroup` はアンドロメダを原点中心へ移し、`setOpacity` を天の川群／アンドロメダ別々の `setOpacities(mw, and)` に置換。`app.ts` が毎フレーム合成不透明度を渡し、`andromedaFade` に応じてラベルを 天の川 →「約250万光年」→ アンドロメダ と出し分ける。

**Tech Stack:** Vite + TypeScript + Three.js + vitest（jsdom）。

## Global Constraints

- 実装ゾーン分離: **純粋ロジック（`andromedaFade`・合成不透明度）は TDD 厳密（RED→GREEN）／見た目（アンドロメダの配置=原点・傾き・サイズ、フェード帯しきい値 2e10/3.5e10、ラベルしきい値 0.35/0.65、ラベル文言）はテストで assert しない**（コントローラが Playwright で実機調整）。テストは「値を変えても壊れない構造的不変条件」のみ。
- 既存の恒星系挙動・光速パルス・惑星公転・4段スケール・近傍星野クロスフェード・クリック選択に**無回帰**であること。
- コミット: `git -c commit.gpgsign=false commit`（署名鍵なし）、メッセージ末尾に `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。`--no-verify` 禁止。
- テスト: `npx vitest run <path>`（個別）/ `npm test`（全体）。型: `npx tsc --noEmit`。dev: `npm run dev` → `http://localhost:5182`（5180/5181 使用中のことあり・起動ログの実ポートを見る）。
- `npm run build` は監査 hook が発火する。test 済み・隔離済みなら末尾に `# CLAUDE_AUDIT_OK` を付けて再実行してよい。
- 既存の児オブジェクト順（`LocalGroup.object.children`）は **天の川(0) / アンドロメダ(1) / marker(2) / orbitLine(3)**。テストがこの順に依存するため、コンストラクタの add 順を変えないこと。

---

### Task 1: 純粋ロジック `andromedaFade` + `localGroupOpacities`（TDD 厳密）

**Files:**
- Modify: `src/nav/localGroupFade.ts`（既存 `localGroupFade` の下に追記）
- Test: `tests/nav/localGroupFade.test.ts`（既存 describe の下に追記）

**Interfaces:**
- Consumes: 既存 `localGroupFade(viewDistanceAu: number): number`（同ファイル）。
- Produces:
  - `ANDROMEDA_FADE_START_AU: number`（=2e10）, `ANDROMEDA_FADE_END_AU: number`（=3.5e10）
  - `andromedaFade(viewDistanceAu: number): number`（smoothstep, 範囲[0,1]）
  - `localGroupOpacities(viewDistanceAu: number): { milkyWay: number; andromeda: number }`

- [ ] **Step 1: Write the failing test**

`tests/nav/localGroupFade.test.ts` の末尾（既存 `describe('localGroupFade', …)` の後）に追記。import 行に関数を追加する:

```typescript
import { localGroupFade, andromedaFade, localGroupOpacities } from '../../src/nav/localGroupFade';
```

```typescript
describe('andromedaFade', () => {
  it('is 0 at or below the start (2e10)', () => {
    expect(andromedaFade(2e10)).toBe(0);
    expect(andromedaFade(1e10)).toBe(0);
  });
  it('is 1 at or above the end (3.5e10)', () => {
    expect(andromedaFade(3.5e10)).toBe(1);
    expect(andromedaFade(5e10)).toBe(1);
  });
  it('increases monotonically across the band', () => {
    let prev = -1;
    for (let v = 2e10; v <= 3.5e10; v += 5e8) {
      const f = andromedaFade(v);
      expect(f).toBeGreaterThanOrEqual(prev);
      prev = f;
    }
  });
});

describe('localGroupOpacities', () => {
  it('shows neither galaxy below the localgroup stage', () => {
    const o = localGroupOpacities(1e9);
    expect(o.milkyWay).toBe(0);
    expect(o.andromeda).toBe(0);
  });
  it('shows the Milky Way (not Andromeda) in the milky-way band', () => {
    const o = localGroupOpacities(1.5e10);
    expect(o.milkyWay).toBeGreaterThan(0.9);
    expect(o.andromeda).toBeLessThan(0.1);
  });
  it('shows Andromeda (not the Milky Way) at maximum zoom-out', () => {
    const o = localGroupOpacities(5e10);
    expect(o.milkyWay).toBeCloseTo(0, 5);
    expect(o.andromeda).toBeCloseTo(1, 5);
  });
  it('crossfades: dominance swaps from Milky Way to Andromeda across the band', () => {
    const near = localGroupOpacities(2.2e10); // MW 優勢
    const far = localGroupOpacities(3.3e10);  // Andromeda 優勢
    expect(near.milkyWay).toBeGreaterThan(near.andromeda);
    expect(far.andromeda).toBeGreaterThan(far.milkyWay);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/nav/localGroupFade.test.ts`
Expected: FAIL（`andromedaFade` / `localGroupOpacities` 未 export でインポート解決不可）

- [ ] **Step 3: Write minimal implementation**

`src/nav/localGroupFade.ts` の末尾（既存 `localGroupFade` 関数の後）に追記:

```typescript
export const ANDROMEDA_FADE_START_AU = 2e10;
export const ANDROMEDA_FADE_END_AU = 3.5e10;

// ズームアウトで天の川→アンドロメダへ切り替える度合い（0=天の川, 1=アンドロメダ）。
export function andromedaFade(viewDistanceAu: number): number {
  const t = clamp(
    (viewDistanceAu - ANDROMEDA_FADE_START_AU) / (ANDROMEDA_FADE_END_AU - ANDROMEDA_FADE_START_AU),
    0, 1,
  );
  return t * t * (3 - 2 * t);
}

// 局部銀河群段での2銀河の不透明度。天の川群は localGroupFade で入り andromedaFade で抜ける、
// アンドロメダは andromedaFade で入る。どちらも localGroupFade=0 の段以前は 0。
export function localGroupOpacities(viewDistanceAu: number): { milkyWay: number; andromeda: number } {
  const lg = localGroupFade(viewDistanceAu);
  const a = andromedaFade(viewDistanceAu);
  return { milkyWay: lg * (1 - a), andromeda: lg * a };
}
```

（`clamp` は同ファイル冒頭で定義済みのものを再利用する。）

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/nav/localGroupFade.test.ts`
Expected: PASS（既存 `localGroupFade` 4件 + 新規 `andromedaFade` 3件 + `localGroupOpacities` 4件）

- [ ] **Step 5: Commit**

```bash
git add src/nav/localGroupFade.ts tests/nav/localGroupFade.test.ts
git -c commit.gpgsign=false commit -m "feat: 天の川→アンドロメダのクロスフェード純粋ロジック（andromedaFade/合成不透明度）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `LocalGroup` — アンドロメダ原点化 + `setOpacities` + app.ts 不透明度結線

**Files:**
- Modify: `src/galaxy/LocalGroup.ts`
- Modify: `src/app.ts`（不透明度呼び出し1箇所 + import）
- Test: `tests/galaxy/localGroup.test.ts`

**Interfaces:**
- Consumes: Task1 `localGroupOpacities(v): {milkyWay, andromeda}`。既存 `GalaxyDisk.setOpacity(o)`。
- Produces: `LocalGroup.setOpacities(milkyWay: number, andromeda: number): void`（旧 `setOpacity` を置換）。アンドロメダディスクは group 原点中心（`children[1]` の world 位置がほぼ原点）。

**注記（実装ゾーン分離）:** アンドロメダの傾き・サイズは見た目＝テストしない。テストは「setOpacities が天の川群とアンドロメダに別々反映」「アンドロメダ中心が原点」「天の川中心は原点からオフセット（従来不変）」の構造のみ。

- [ ] **Step 1: 既存テストを新仕様へ更新（失敗させる）**

`tests/galaxy/localGroup.test.ts` の `it('setOpacity propagates to both disks', …)`（1件）を**丸ごと**次の2件に置換する。ファイル冒頭の `import * as THREE from 'three';` は既にあるので不要:

```typescript
  it('setOpacities sets the Milky Way group and Andromeda independently', () => {
    const lg = new LocalGroup();
    lg.setOpacities(0.3, 0.7);
    const points = lg.object.children.filter((c) => c.type === 'Points');
    const mwU = (points[0] as unknown as { material: { uniforms: { uOpacity: { value: number } } } })
      .material.uniforms.uOpacity.value;
    const andU = (points[1] as unknown as { material: { uniforms: { uOpacity: { value: number } } } })
      .material.uniforms.uOpacity.value;
    expect(mwU).toBe(0.3);   // children[0] = 天の川
    expect(andU).toBe(0.7);  // children[1] = アンドロメダ
    // 現在地マーカー(Mesh)と公転円(Line)は我々の銀河の要素なので天の川側に追従する
    let markerOpacity: number | undefined;
    let lineOpacity: number | undefined;
    lg.object.traverse((o) => {
      if (o.type === 'Mesh') markerOpacity = (o as unknown as { material: { opacity: number } }).material.opacity;
      if (o instanceof THREE.Line) lineOpacity = (o as unknown as { material: { opacity: number } }).material.opacity;
    });
    expect(markerOpacity).toBe(0.3);
    expect(lineOpacity).toBe(0.3);
    lg.dispose();
  });
  it('centers Andromeda at the group origin (crossfade, not side-by-side)', () => {
    const lg = new LocalGroup();
    const points = lg.object.children.filter((c) => c.type === 'Points');
    const andCenter = new THREE.Vector3();
    points[1]!.getWorldPosition(andCenter); // children[1] = アンドロメダ
    expect(andCenter.length()).toBeLessThan(1e8); // 横オフセット撤去＝原点中心
    lg.dispose();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/galaxy/localGroup.test.ts`
Expected: FAIL（`setOpacities` 未定義／アンドロメダがまだ横オフセット `andCenter.length()` 大）

- [ ] **Step 3: `LocalGroup` を実装変更**

`src/galaxy/LocalGroup.ts` に3点の変更を行う。

(a) import から未使用になる `ANDROMEDA_OFFSET_AU` を外す:

```typescript
import { MILKY_WAY, ANDROMEDA } from './galaxyParams';
```

(b) アンドロメダの位置を原点中心へ（傾きは維持）。該当行を置換:

```typescript
    // アンドロメダ銀河（外から眺める＝銀河中心を画面中央=原点に。ズームアウトで天の川とクロスフェード）
    this.andromeda = new GalaxyDisk(ANDROMEDA, 2);
    this.andromeda.object.position.set(0, 0, 0);
    this.andromeda.object.rotation.x = 0.7;
    this.andromeda.object.rotation.z = 0.3;
    this.object.add(this.andromeda.object);
```

(c) `setOpacity(o)` メソッドを `setOpacities(milkyWay, andromeda)` に置換:

```typescript
  setOpacities(milkyWay: number, andromeda: number): void {
    this.milkyWay.setOpacity(milkyWay);
    this.andromeda.setOpacity(andromeda);
    (this.marker.material as THREE.MeshBasicMaterial).opacity = milkyWay;
    (this.orbitLine.material as THREE.LineBasicMaterial).opacity = milkyWay;
  }
```

- [ ] **Step 4: `app.ts` の不透明度結線を更新（build を緑に保つ）**

`src/app.ts` の import 行を更新:

```typescript
import { localGroupFade, localGroupOpacities } from './nav/localGroupFade';
```

frame ループ内の該当行（`localGroup.setOpacity(lgFade);`）を置換:

```typescript
    localGroup.object.visible = lgFade > 0;
    const lgOpacities = localGroupOpacities(nav.viewDistanceAu);
    localGroup.setOpacities(lgOpacities.milkyWay, lgOpacities.andromeda);
```

（`lgFade` は `field.setOpacity(1 - lgFade)` と `localGroup.object.visible` で引き続き使用するため残す。）

- [ ] **Step 5: 型チェック・テスト・ビルド**

Run:
```bash
npx tsc --noEmit
npx vitest run tests/galaxy/localGroup.test.ts
npm test
npm run build   # CLAUDE_AUDIT_OK （純粋/構造は TDD 済み・app.ts 結線は最小1行差し替え）
```
Expected: tsc エラー0 ／ localGroup テスト（既存の Points 2個・midpoint・marker・MW中心オフセット・orbit line・spin・galacticCenter + 新規 setOpacities・Andromeda 原点）全 pass ／ 全体 pass ／ build 成功。

- [ ] **Step 6: Commit**

```bash
git add src/galaxy/LocalGroup.ts src/app.ts tests/galaxy/localGroup.test.ts
git -c commit.gpgsign=false commit -m "feat: アンドロメダを原点中心化し天の川と別々に不透明度制御（クロスフェード土台）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `app.ts` ラベル遷移 ＋ Playwright E2E（統合・コントローラ実施）

**Files:**
- Modify: `src/app.ts`（import に `andromedaFade` 追加 / 局部銀河群ラベルブロックを andFade で出し分け）

**Interfaces:**
- Consumes: Task1 `andromedaFade`、既存 `localGroup.markerWorldPos()`／`galacticCenterWorldPos()`／`midpointWorldPos()`、`SUN_FACTS`。

**注記:** 統合レイヤは app.ts に単体テストが無い（このプロジェクトのアーキ）。TDD ではなく **Playwright E2E で受入基準を検証**する。ラベルしきい値（0.35/0.65）と文言は見た目＝実機調整可。

- [ ] **Step 1: import に `andromedaFade` を追加**

`src/app.ts` の該当 import（Task2 で `{ localGroupFade, localGroupOpacities }` になっている）を更新:

```typescript
import { localGroupFade, localGroupOpacities, andromedaFade } from './nav/localGroupFade';
```

- [ ] **Step 2: 局部銀河群ラベルブロックを andFade で出し分け**

`src/app.ts` の `if (lgFade > 0.5) { … }` ブロック（「現在地（太陽系）」「太陽の銀河公転…」「約250万光年」の3ラベルを push している箇所）を**丸ごと**次に置換:

```typescript
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
```

- [ ] **Step 3: 型チェック・全テスト・ビルド**

Run:
```bash
npx tsc --noEmit
npm test
npm run build   # CLAUDE_AUDIT_OK （app.ts ラベル出し分けのみ・E2Eで検証）
```
Expected: tsc エラー0 ／ 全テスト pass（Task1/2 の新規含む）／ build 成功。

- [ ] **Step 4: Playwright E2E（コントローラが実機検証）**

`npm run dev`（→ 実ポート）で、`browser_evaluate` により canvas へ `WheelEvent(deltaY>0)` を段階 dispatch し `browser_take_screenshot`＋`Read` で目視:

1. ズームアウトで 近傍星野 → 天の川ディスク（現在地マーカー／公転円／「天の川銀河（現在地）」ラベル）を確認。
2. さらにズームアウト（viewDistanceAu を 2e10→3.5e10 帯へ）で **天の川がフェードアウト → アンドロメダがフェードイン**し、**横並びが解消**され常に中央は1つの銀河であることをスクショで確認（クロスフェード中間帯・アンドロメダ主役帯の2枚）。
3. ラベルが 天の川 →「← 約250万光年 → アンドロメダ銀河へ」→「アンドロメダ銀河（M31）…」と遷移。
4. ズームで戻すと アンドロメダ → 天の川 → 近傍星野 へ逆再生（現在地マーカー復帰）。
5. 無回帰: 近傍星野クロスフェード・スケールバー非表示（localgroup 段）・クリック非干渉・惑星公転・光速パルス・console は favicon404 のみ。

見た目が弱ければ `ANDROMEDA_FADE_START_AU`/`ANDROMEDA_FADE_END_AU`（localGroupFade.ts）・アンドロメダの傾き/サイズ・ラベルしきい値 0.35/0.65 を実機調整（テストに影響しない見た目パラメータ）。強い違和感（アンドロメダのサイズ変化）があれば spec §5 の follow-up（画面基準サイズ化）を別途検討。

- [ ] **Step 5: Commit**

```bash
git add src/app.ts
git -c commit.gpgsign=false commit -m "feat: 局部銀河群ラベルを天の川→約250万光年→アンドロメダに遷移

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 完了後

全3タスク完了後、最上位モデル（opus）で全ブランチ最終レビュー（`<BASE>..HEAD`、BASE = Task1 着手前の HEAD）→ 指摘対応 → `.superpowers/sdd/progress.md`／`SESSION_HANDOFF.md` 更新。

## Self-Review（記入済み）

- **Spec coverage:** §1 配置変更=Task2(b)・テスト「Andromeda 原点」。§2 フェード帯/合成=Task1(andromedaFade/localGroupOpacities)+Task2(setOpacities)+app 結線。§3 ラベル遷移=Task3。§4 スコープ外（Andromeda 内部侵入なし・パネル文言据置）=どのタスクも触れず。§5 トレードオフ=Task3 Step4 の実機調整注記。TDD 対象不変条件（§実装ゾーン分離）=Task1 のテスト（境界・単調・範囲・代表点の大小）+Task2 の構造テスト。
- **Placeholder scan:** なし（全 step に実コード・実コマンド・期待値）。
- **Type consistency:** `andromedaFade(v:number):number` / `localGroupOpacities(v):{milkyWay,andromeda}`（Task1）→ Task2 の `setOpacities(milkyWay,andromeda)` 呼び出し・app 結線、Task3 の `andromedaFade` 呼び出しが一致。`children[0]`=天の川/`[1]`=アンドロメダの順序前提を Global Constraints と Task2 テストで固定。`midpointWorldPos`/`markerWorldPos`/`galacticCenterWorldPos` は既存シグネチャのまま使用。
