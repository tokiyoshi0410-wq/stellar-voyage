# stellar-voyage 星ラベル・距離表示・軌道視認性 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 連続ズーム航法に、銀河ビューの星名ラベル・星系ビューの惑星名+距離ラベル・太陽系軌道リングの視認性向上を追加する。

**Architecture:** 純粋な最近傍星計算 (`nearestStarsPc`) と距離整形 (`formatAuDistance`) を土台に、DOM オーバーレイ `LabelLayer` が毎フレーム world 位置を Three カメラの `project()`（float64）で画面へ投影・配置。`app.ts` が `fade = systemFade(viewDistanceAu)` で系ラベル/銀河ラベルを切替。`SystemScene` の軌道リングを明るく・惑星色に。

**Tech Stack:** TypeScript 5.9、Three.js、Vite 7、vitest 3。追加ランタイム依存なし。

## Global Constraints

- 全ユーザー向け文言は**日本語**。ワールド単位 **AU**、銀河星は `pc × AU_PER_PC(206264.8)`。フォーカス星が scene 原点。
- TS strict + `noUncheckedIndexedAccess` ON（配列/Float32Array 添字は `!`、既存慣習に従う）。ランタイム依存は Three.js のみ、`"type":"module"`。
- テストは vitest（既定環境 jsdom）。純粋ロジックは単体テスト。ラベル投影・軌道の見え・追従は Playwright 目視（コントローラ）。
- コミットはタスク単位。メッセージ末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。署名エラー時は `git -c commit.gpgsign=false commit`、`--no-verify` は使わない。
- ビルド系コマンド (`npm run build`) は監査 hook 発火時に末尾 `# CLAUDE_AUDIT_OK`（変更が test 済み・隔離済みの場合）。

## 既存モジュール（このプランが依存/改修する実シグネチャ）

- `catalog/format.ts`: `StarColumns { count; x/y/z/mag/absmag/ci: Float32Array }`（x/y/z はパーセク）
- `catalog/StarCatalog.ts`: `StarCatalog { columns; nameOf(index): string | null }`
- `system/orbit.ts`: `orbitPosition(a, phase): [number,number,number]`, `planetPhase(starIndex, planetIndex): number`
- `system/SystemScene.ts`: `SystemScene { root; planetMeshes; system; dispose() }`, `planetTypeColor(type): number`。軌道リングは現在 `RingGeometry(a-0.004,a+0.004,128)` + `MeshBasicMaterial(color:0x2b4a7a, opacity:0.5)`（極細・暗い）。
- `astro/spectral.ts`: `PARSEC_IN_LY = 3.2615637769`
- `starfield/StarField.ts`: `AU_PER_PC = 206264.8`
- `ui/format.ts`: `describeStar(columns,index,name): StarInfo`（既存）。本プランで `formatAuDistance` を追加。
- `nav/nearestStar.ts`: `nearestStarPc(focusPc, columns): {index,distPc}`（据え置き。本プランは別関数を追加）
- `app.ts`: frame ループ内で `fp = [focusWorldAu[i]/AU_PER_PC]`、`fade = systemFade(nav.viewDistanceAu)`、`camAu`、`engine.camera`、`engine.renderer.domElement`、`currentSystem`（`.starIndex`/`.starName`/`.planets`）が利用可能。

## File Structure

```
src/nav/nearestStars.ts        # 新規（純粋）: 近い順 N 星
src/ui/format.ts               # 改修: formatAuDistance + AU_IN_OKUKM を追加
src/ui/LabelLayer.ts           # 新規（DOM）: ラベルのプール管理・投影配置
src/system/SystemScene.ts      # 改修: 軌道リングを明るく・惑星色に
src/app.ts                     # 改修: LabelLayer 結線（毎フレーム）
tests/nav/nearestStars.test.ts        # 新規
tests/ui/format.test.ts               # 追記（formatAuDistance）
tests/ui/labelLayer.test.ts           # 新規
tests/system/systemSceneOrbitRing.test.ts  # 新規
```

---

### Task 1: nearestStarsPc（純粋・近い順 N 星）

**Files:**
- Create: `src/nav/nearestStars.ts`
- Test: `tests/nav/nearestStars.test.ts`

**Interfaces:**
- Consumes: `StarColumns`（catalog/format）
- Produces: `nearestStarsPc(focusPc: [number,number,number], columns: StarColumns, count: number): { index: number; distPc: number }[]`（距離昇順、最大 count 件。count<=0 は空、count>=星数なら全件）

- [ ] **Step 1: 失敗するテストを書く**

`tests/nav/nearestStars.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { nearestStarsPc } from '../../src/nav/nearestStars';

const columns = {
  count: 4,
  x: new Float32Array([0, 1, 5, 2]), y: new Float32Array([0, 0, 0, 0]), z: new Float32Array([0, 0, 0, 0]),
  mag: new Float32Array([1, 1, 1, 1]), absmag: new Float32Array([1, 1, 1, 1]), ci: new Float32Array([0, 0, 0, 0]),
};

describe('nearestStarsPc', () => {
  it('returns the `count` nearest stars in ascending distance', () => {
    const r = nearestStarsPc([0, 0, 0], columns, 2);
    expect(r.map((s) => s.index)).toEqual([0, 1]);
    expect(r[0]!.distPc).toBeCloseTo(0, 6);
    expect(r[1]!.distPc).toBeCloseTo(1, 6);
  });
  it('orders by distance from the focus point, not catalog order', () => {
    const r = nearestStarsPc([5, 0, 0], columns, 2);
    expect(r.map((s) => s.index)).toEqual([2, 3]); // x=5 (d0), x=2 (d3) beats x=1 (d4)
  });
  it('handles count <= 0 and count > star count', () => {
    expect(nearestStarsPc([0, 0, 0], columns, 0)).toEqual([]);
    expect(nearestStarsPc([0, 0, 0], columns, 99).length).toBe(4);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- nearestStars`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 実装**

`src/nav/nearestStars.ts`:
```ts
import type { StarColumns } from '../catalog/format';

export function nearestStarsPc(
  focusPc: [number, number, number],
  columns: StarColumns,
  count: number,
): { index: number; distPc: number }[] {
  if (count <= 0) return [];
  const best: { index: number; d2: number }[] = [];
  for (let i = 0; i < columns.count; i++) {
    const dx = columns.x[i]! - focusPc[0];
    const dy = columns.y[i]! - focusPc[1];
    const dz = columns.z[i]! - focusPc[2];
    const d2 = dx * dx + dy * dy + dz * dz;
    if (best.length < count) {
      best.push({ index: i, d2 });
      best.sort((a, b) => a.d2 - b.d2);
    } else if (d2 < best[best.length - 1]!.d2) {
      best[best.length - 1] = { index: i, d2 };
      best.sort((a, b) => a.d2 - b.d2);
    }
  }
  return best.map((b) => ({ index: b.index, distPc: Math.sqrt(b.d2) }));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- nearestStars`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/nav/nearestStars.ts tests/nav/nearestStars.test.ts
git -c commit.gpgsign=false commit -m "feat: add nearestStarsPc (N nearest catalog stars)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: formatAuDistance（距離整形・純粋）

**Files:**
- Modify: `src/ui/format.ts`（末尾に追加。既存 `describeStar` 等は不変）
- Test: `tests/ui/format.test.ts`（既存ファイルに追記）

**Interfaces:**
- Consumes: なし
- Produces: `AU_IN_OKUKM = 1.496`, `formatAuDistance(au: number): string`（例 `"1.0 AU ≈ 1.5億km"`）

- [ ] **Step 1: 失敗するテストを追記**

`tests/ui/format.test.ts` の末尾（既存 import 群の下、既存 describe の外）に追記。ファイル先頭の import 行に `formatAuDistance` を追加する（既に `describeStar` 等を import しているはず。無ければ `import { formatAuDistance } from '../../src/ui/format';` を追加）:
```ts
import { formatAuDistance } from '../../src/ui/format';

describe('formatAuDistance', () => {
  it('shows AU and 億km for Earth (1 AU ≈ 1.5億km)', () => {
    const s = formatAuDistance(1.0);
    expect(s).toMatch(/1\.0 AU/);
    expect(s).toMatch(/1\.5億km/);
  });
  it('formats inner and outer planets sensibly', () => {
    expect(formatAuDistance(0.39)).toMatch(/0\.39 AU/);
    expect(formatAuDistance(30.1)).toMatch(/30 AU/);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- format`
Expected: FAIL（`formatAuDistance` 未定義）

- [ ] **Step 3: 実装**

`src/ui/format.ts` の末尾に追加:
```ts
// 1 AU = 1.496×10^8 km = 1.496 億km
export const AU_IN_OKUKM = 1.496;

export function formatAuDistance(au: number): string {
  const auStr = au >= 10 ? au.toFixed(0) : au.toFixed(au < 1 ? 2 : 1);
  const okm = (au * AU_IN_OKUKM).toPrecision(2);
  return `${auStr} AU ≈ ${okm}億km`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- format`
Expected: PASS（既存 + 新規）

- [ ] **Step 5: コミット**

```bash
git add src/ui/format.ts tests/ui/format.test.ts
git -c commit.gpgsign=false commit -m "feat: add formatAuDistance (AU + 億km)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: LabelLayer（DOM オーバーレイ）

**Files:**
- Create: `src/ui/LabelLayer.ts`
- Test: `tests/ui/labelLayer.test.ts`

**Interfaces:**
- Consumes: three
- Produces: `type LabelItem = { text: string; worldPos: [number,number,number] }`, `class LabelLayer { constructor(root: HTMLElement); render(items: LabelItem[], camera: THREE.Camera, domEl: HTMLElement): void }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/labelLayer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LabelLayer } from '../../src/ui/LabelLayer';

function rootWithSize() {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: 800 });
  Object.defineProperty(root, 'clientHeight', { value: 600 });
  return root;
}
function camAtOrigin() {
  const cam = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('LabelLayer', () => {
  it('shows an on-screen label with its text', () => {
    const root = rootWithSize();
    const layer = new LabelLayer(root);
    layer.render([{ text: '地球', worldPos: [0, 0, 0] }], camAtOrigin(), root);
    const container = root.querySelector('div')!;
    const label = container.children[0] as HTMLDivElement;
    expect(label.textContent).toBe('地球');
    expect(label.style.display).toBe('block');
  });
  it('hides a label positioned behind the camera', () => {
    const root = rootWithSize();
    const layer = new LabelLayer(root);
    layer.render([{ text: 'behind', worldPos: [0, 0, 100] }], camAtOrigin(), root);
    const container = root.querySelector('div')!;
    const label = container.children[0] as HTMLDivElement;
    expect(label.style.display).toBe('none');
  });
  it('reuses the element pool: fewer items hides the extras', () => {
    const root = rootWithSize();
    const layer = new LabelLayer(root);
    const cam = camAtOrigin();
    layer.render([{ text: 'a', worldPos: [0, 0, 0] }, { text: 'b', worldPos: [1, 0, 0] }], cam, root);
    layer.render([{ text: 'a', worldPos: [0, 0, 0] }], cam, root);
    const container = root.querySelector('div')!;
    expect(container.children.length).toBe(2); // pool kept
    expect((container.children[1] as HTMLDivElement).style.display).toBe('none'); // extra hidden
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- labelLayer`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 実装**

`src/ui/LabelLayer.ts`:
```ts
import * as THREE from 'three';

export type LabelItem = { text: string; worldPos: [number, number, number] };

export class LabelLayer {
  private readonly container: HTMLDivElement;
  private readonly pool: HTMLDivElement[] = [];
  private readonly v = new THREE.Vector3();

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;';
    root.appendChild(this.container);
  }

  render(items: LabelItem[], camera: THREE.Camera, domEl: HTMLElement): void {
    const w = domEl.clientWidth, h = domEl.clientHeight;
    for (let i = 0; i < items.length; i++) {
      const el = this.ensure(i);
      const item = items[i]!;
      this.v.set(item.worldPos[0], item.worldPos[1], item.worldPos[2]).project(camera);
      if (this.v.z < -1 || this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) {
        el.style.display = 'none';
        continue;
      }
      const left = (this.v.x * 0.5 + 0.5) * w;
      const top = (-this.v.y * 0.5 + 0.5) * h;
      el.textContent = item.text;
      el.style.transform = `translate(${left}px, ${top}px) translate(0, -50%)`;
      el.style.display = 'block';
    }
    for (let i = items.length; i < this.pool.length; i++) this.pool[i]!.style.display = 'none';
  }

  private ensure(i: number): HTMLDivElement {
    let el = this.pool[i];
    if (!el) {
      el = document.createElement('div');
      el.style.cssText =
        'position:absolute;left:0;top:0;color:#d6e4ff;font:11px system-ui,sans-serif;' +
        'text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap;pointer-events:none;padding-left:6px;';
      this.container.appendChild(el);
      this.pool[i] = el;
    }
    return el;
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- labelLayer`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/ui/LabelLayer.ts tests/ui/labelLayer.test.ts
git -c commit.gpgsign=false commit -m "feat: add LabelLayer (projected DOM labels)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 軌道リングの視認性向上（SystemScene）

**Files:**
- Modify: `src/system/SystemScene.ts`（惑星ループ内の軌道リング生成のみ変更）
- Test: `tests/system/systemSceneOrbitRing.test.ts`

**Interfaces:**
- Consumes: `planetTypeColor`（SystemScene、既存 export）
- Produces: 挙動変更のみ（軌道リングの色=惑星型色、opacity=0.85、幅=`max(0.01, a*0.01)`）

- [ ] **Step 1: 失敗するテストを書く**

`tests/system/systemSceneOrbitRing.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SystemScene, planetTypeColor } from '../../src/system/SystemScene';
import type { StellarSystem } from '../../src/system/types';

function sysOneOceanPlanet(): StellarSystem {
  return {
    starIndex: 0, starName: 'T', spectralClass: 'G', temperatureK: 5800, luminositySun: 1,
    planets: [{ name: 'p', type: 'ocean', semiMajorAxisAu: 1, radiusEarth: 1, massEarth: 1, eqTempK: null, inHabitableZone: true, isReal: true, estimated: false }],
  };
}

describe('SystemScene orbit ring visibility', () => {
  it('draws the orbit ring in the planet type color at high opacity', () => {
    const scene = new SystemScene(sysOneOceanPlanet());
    const ring = scene.root.children.find(
      (o): o is THREE.Mesh => o instanceof THREE.Mesh && o.geometry instanceof THREE.RingGeometry,
    )!;
    const mat = ring.material as THREE.MeshBasicMaterial;
    expect(mat.color.getHex()).toBe(planetTypeColor('ocean'));
    expect(mat.opacity).toBeCloseTo(0.85, 5);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- systemSceneOrbitRing`
Expected: FAIL（現在の色は `0x2b4a7a`、opacity 0.5）

- [ ] **Step 3: 実装**

`src/system/SystemScene.ts` の惑星ループ内、現在の軌道リング生成ブロック
```ts
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(p.semiMajorAxisAu - 0.004, p.semiMajorAxisAu + 0.004, 128),
        new THREE.MeshBasicMaterial({ color: 0x2b4a7a, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.root.add(ring);
```
を次に置き換える:
```ts
      const ringWidth = Math.max(0.01, p.semiMajorAxisAu * 0.01);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(p.semiMajorAxisAu - ringWidth, p.semiMajorAxisAu + ringWidth, 128),
        new THREE.MeshBasicMaterial({
          color: planetTypeColor(p.type), side: THREE.DoubleSide, transparent: true, opacity: 0.85,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.root.add(ring);
```
（惑星本体・土星の環・中央星・PointLight は不変。`planetMeshes` にリングは追加しない。）

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- systemSceneOrbitRing`。続けて `npm test`（全体緑）、`npx tsc --noEmit`（クリーン）。
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/system/SystemScene.ts tests/system/systemSceneOrbitRing.test.ts
git -c commit.gpgsign=false commit -m "feat: brighten orbit rings with per-planet color" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: app.ts 結線（毎フレームのラベル描画）

**Files:**
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `LabelLayer`/`LabelItem`（Task 3）, `nearestStarsPc`（Task 1）, `formatAuDistance`（Task 2）, `orbitPosition`/`planetPhase`（system/orbit）, `PARSEC_IN_LY`（astro/spectral）, 既存 `AU_PER_PC`/`systemFade`/`catalog`/`currentSystem`/`fp`/`fade`/`engine`
- Produces: 挙動のみ（app は単体テストなし）

**この Task の検証:** ハードゲートは `npx tsc --noEmit` クリーン + `npm run build` 成功 + `npm test` 全緑。ラベルの見え・追従・切替はコントローラが Playwright で実施。

**受入基準（目視）:**
1. 太陽系ビュー: 各惑星のそばに「名前＋AU＋億km」（地球=1.0 AU ≈ 1.5億km）、中央に星名、軌道リングが明るく惑星色。
2. ズームアウトで銀河へ: 系ラベルが消え、カメラ近傍の星に「名前 or HYG #idx＋光年」。
3. ドラッグ/WASD/ズームでラベルが追従、画面外は消える。クリック選択を妨げない。

- [ ] **Step 1: import を追加**

`src/app.ts` の import 群に追加（`describeStar` の行は `formatAuDistance` を併記）:
```ts
import { orbitPosition, planetPhase } from './system/orbit';
import { LabelLayer, type LabelItem } from './ui/LabelLayer';
import { nearestStarsPc } from './nav/nearestStars';
import { PARSEC_IN_LY } from './astro/spectral';
```
既存の `import { describeStar } from './ui/format';` を
```ts
import { describeStar, formatAuDistance } from './ui/format';
```
に変更する。

- [ ] **Step 2: LabelLayer を生成**

`const planetPanel = new PlanetPanel(root);` の直後（他の UI 生成と同じ場所）に追加:
```ts
  const labels = new LabelLayer(root);
```

- [ ] **Step 3: frame ループにラベル描画を追加**

frame ループ内、フェード反映ブロック（`systemScene.root.visible = fade > 0;` を含む `if (systemScene) { ... }`）の**直後**、`slider.setReadout(...)` の**直前**に挿入する（`fp` と `fade` は同ループ内で計算済み）:
```ts
    // --- ラベル（星名 / 惑星名+距離） ------------------------------------
    const labelItems: LabelItem[] = [];
    if (fade > 0.5) {
      labelItems.push({ text: currentSystem.starName, worldPos: [0, 0, 0] });
      currentSystem.planets.forEach((p, i) => {
        const [px, py, pz] = orbitPosition(p.semiMajorAxisAu, planetPhase(currentSystem.starIndex, i));
        labelItems.push({ text: `${p.name}  ${formatAuDistance(p.semiMajorAxisAu)}`, worldPos: [px, py, pz] });
      });
    } else {
      const cols = catalog.columns;
      for (const s of nearestStarsPc(fp, cols, 15)) {
        const px = cols.x[s.index]!, py = cols.y[s.index]!, pz = cols.z[s.index]!;
        const worldPos: [number, number, number] = [
          (px - fp[0]) * AU_PER_PC, (py - fp[1]) * AU_PER_PC, (pz - fp[2]) * AU_PER_PC,
        ];
        const distSolPc = Math.hypot(px, py, pz);
        const name = catalog.nameOf(s.index) ?? `HYG #${s.index}`;
        labelItems.push({ text: `${name}  ${(distSolPc * PARSEC_IN_LY).toFixed(1)} 光年`, worldPos });
      }
    }
    labels.render(labelItems, engine.camera, engine.renderer.domElement);
```

- [ ] **Step 4: 型チェック / ビルド / テスト**

Run: `npx tsc --noEmit` → クリーン。`npm run build`（監査 hook 時 `# CLAUDE_AUDIT_OK`）→ 成功。`npm test` → 全緑（app は単体なし）。

- [ ] **Step 5: コミット**

```bash
git add src/app.ts
git -c commit.gpgsign=false commit -m "feat: render star/planet labels via LabelLayer each frame" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review（計画作成者による点検結果）

**1. Spec coverage:**
- 銀河ビューの星名ラベル（カメラ近傍・名前 or HYG#・光年）: Task 1 + Task 5 ✓
- 星系ビューの惑星名+距離ラベル（AU+億km）+ 中央星名: Task 2 + Task 5 ✓
- DOM オーバーレイ + Three 投影（float64）: Task 3 ✓
- 軌道リングの視認性（明るく・惑星色・幅）: Task 4 ✓
- fade 連動の切替 / pointer-events:none: Task 3（CSS）+ Task 5（分岐）✓
- テスト（最近傍 N・距離整形・ラベル投影・軌道色）: Task 1,2,3,4 ✓

**2. Placeholder scan:** 全ステップに実コード。TBD/TODO なし。

**3. Type consistency:**
- `nearestStarsPc(focusPc, columns, count) → {index,distPc}[]` は Task 1 定義を Task 5 が使用、一致。
- `formatAuDistance(au) → string` は Task 2 定義を Task 5 が使用、一致。
- `LabelItem { text; worldPos }` / `LabelLayer.render(items, camera, domEl)` は Task 3 定義を Task 5 が使用、一致。
- `planetTypeColor(type)` は既存、Task 4 が使用、一致。
- `orbitPosition`/`planetPhase`/`PARSEC_IN_LY`/`AU_PER_PC` は既存シグネチャ、Task 5 で使用。

**4. 回帰リスク:** 追加は新規モジュール + app.ts への追記 + SystemScene の軌道リスト1箇所。既存の描画/選択/フォーカス切替は不変。ラベルは `pointer-events:none` でクリックを透過。コントローラが Playwright で追従・切替・クリック非干渉を確認。

---

## 実行方式

**Subagent-Driven** 推奨。純粋モジュール（Task 1,2）と DOM（Task 3,4）は完全コード転記 + TDD で標準〜cheap モデル、app.ts 結線（Task 5）は標準モデル。Task 4,5 の描画後にコントローラが実データ + Playwright でラベル・軌道・切替・クリック非干渉を検証。
