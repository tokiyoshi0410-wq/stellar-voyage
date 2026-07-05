# stellar-voyage 縮尺バー + 局部銀河群 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 画面左下にズーム連動の縮尺バー（AU/光年/万光年）を表示し、天の川銀河のさらに外へズームすると「局部銀河群」段で天の川銀河⇔アンドロメダ銀河の模式図を表示する。

**Architecture:** 純粋関数 `scaleBarFor`（カメラ投影→切りのいい距離＋bar幅px）と `scaleInfoFor` の `localgroup` 段追加を土台に、DOM の `ScaleBar`（左下）と `LocalGroupDiagram`（中央・模式図）を `app.ts` が毎フレーム更新。

**Tech Stack:** TypeScript 5.9、Three.js（本機能は純粋ロジック＋DOM、Three 非依存）、Vite 7、vitest 3。追加依存なし。

## Global Constraints

- 全ユーザー向け文言は**日本語**、小学生が読める平易な表現。ワールド単位 **AU**。
- TS strict + `noUncheckedIndexedAccess`（配列添字は `!`）。ランタイム依存は Three.js のみ、`"type":"module"`。
- テストは vitest（既定 jsdom）。純粋ロジックは単体。バー・模式図・段切替は Playwright 目視（コントローラ）。
- コミットはタスク単位、末尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。署名エラー時 `git -c commit.gpgsign=false commit`、`--no-verify` 禁止。
- ビルド系 (`npm run build`) は監査 hook 発火時に末尾 `# CLAUDE_AUDIT_OK`。
- 既存 UI 配置: スケールパネル=左上、Info/PlanetPanel=右上、速度スライダー=下中央、操作ヒント=右下。**縮尺バーは左下**。全オーバーレイ `pointer-events:none`。

## 既存モジュール（依存/改修）

- `src/ui/format.ts`: `AU_IN_OKUKM = 1.496`（既存 export）
- `src/edu/scaleInfo.ts`: `formatLightTime`, `interface ScaleInfo { stage; title; lines }`, `scaleInfoFor(viewDistanceAu)`。stage は現在 solar/interstellar/galaxy。本プランで `localgroup` を追加。
- `src/app.ts`: frame ループで `nav.viewDistanceAu`、`engine.camera.fov`（=60）、`engine.renderer.domElement.clientHeight`、`scaleInfo`（既存 `scaleInfoFor` の結果）が利用可能。既存ラベル分岐 `} else if (scaleInfo.stage !== 'galaxy') {`。既存 UI 生成の並び（`const scalePanel = new ScalePanel(root);` の付近）。

## File Structure

```
src/edu/scaleBar.ts                 # 新規（純粋）: niceRound + lightTimeShort + scaleBarFor
src/ui/ScaleBar.ts                  # 新規（DOM）: 左下 縮尺バー
src/edu/scaleInfo.ts                # 改修: localgroup 段追加
src/ui/LocalGroupDiagram.ts         # 新規（DOM）: 局部銀河群 模式図
src/app.ts                          # 改修: scaleBar/localGroup 結線 + ラベル条件更新
tests/edu/scaleBar.test.ts          # 新規
tests/edu/scaleInfo.test.ts         # 追記（localgroup 段）
tests/ui/scaleBar.test.ts           # 新規
tests/ui/localGroupDiagram.test.ts  # 新規
```

---

### Task 1: scaleBar（縮尺計算・純粋）

**Files:**
- Create: `src/edu/scaleBar.ts`
- Test: `tests/edu/scaleBar.test.ts`

**Interfaces:**
- Consumes: `AU_IN_OKUKM`（ui/format）
- Produces: `niceRound(x: number): number`, `scaleBarFor(viewDistanceAu: number, screenHeightPx: number, fovYRad: number): { label: string; widthPx: number }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/edu/scaleBar.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { scaleBarFor, niceRound } from '../../src/edu/scaleBar';

describe('niceRound', () => {
  it('rounds down to the nearest 1/2/5 × 10^n', () => {
    expect(niceRound(7.4)).toBe(5);
    expect(niceRound(12)).toBe(10);
    expect(niceRound(3)).toBe(2);
    expect(niceRound(0.0092)).toBeCloseTo(0.005, 6);
  });
});

describe('scaleBarFor', () => {
  const FOV = (60 * Math.PI) / 180;
  it('uses AU (with 億km + light-time) at solar zoom, width within [32,160]', () => {
    const b = scaleBarFor(40, 1000, FOV);
    expect(b.label).toMatch(/AU/);
    expect(b.label).toMatch(/億km/);
    expect(b.label).toMatch(/分|時間|日/);
    expect(b.widthPx).toBeGreaterThan(31);
    expect(b.widthPx).toBeLessThanOrEqual(160);
  });
  it('switches to 光年 at galaxy zoom', () => {
    const b = scaleBarFor(1e6, 1000, FOV);
    expect(b.label).toMatch(/光年/);
    expect(b.label).not.toMatch(/AU/);
  });
  it('switches to 万光年 at local-group zoom', () => {
    const b = scaleBarFor(1e10, 1000, FOV);
    expect(b.label).toMatch(/万光年/);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- scaleBar`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 実装**

`src/edu/scaleBar.ts`:
```ts
import { AU_IN_OKUKM } from '../ui/format';

const AU_PER_LY = 63241.077;
const LIGHT_MIN_PER_AU = 8.317;
const TARGET_PX = 160;

export function niceRound(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / p;
  const nice = m >= 5 ? 5 : m >= 2 ? 2 : 1;
  return nice * p;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('ja-JP') : String(n);
}

// 縮尺バー用の光の到達時間（分を優先。小学生向けに「83分」等を保つ）。
function lightTimeShort(au: number): string {
  const min = au * LIGHT_MIN_PER_AU;
  if (min < 90) return `${Math.round(min)}分`;
  const hours = min / 60;
  if (hours < 48) return `約${Math.round(hours)}時間`;
  return `約${Math.round(hours / 24)}日`;
}

export function scaleBarFor(
  viewDistanceAu: number,
  screenHeightPx: number,
  fovYRad: number,
): { label: string; widthPx: number } {
  const worldHeightAu = 2 * viewDistanceAu * Math.tan(fovYRad / 2);
  const pxPerAu = screenHeightPx / worldHeightAu;
  const rawAu = TARGET_PX / pxPerAu;
  if (rawAu < 6000) {
    const niceAu = niceRound(rawAu);
    const okm = (niceAu * AU_IN_OKUKM).toPrecision(2);
    return {
      label: `${fmtNum(niceAu)} AU ≈ ${okm}億km（光で ${lightTimeShort(niceAu)}）`,
      widthPx: niceAu * pxPerAu,
    };
  }
  const ly = rawAu / AU_PER_LY;
  if (ly < 10000) {
    const niceLy = niceRound(ly);
    return { label: `${fmtNum(niceLy)} 光年`, widthPx: niceLy * AU_PER_LY * pxPerAu };
  }
  const niceWan = niceRound(ly / 10000);
  return { label: `${fmtNum(niceWan)}万光年`, widthPx: niceWan * 10000 * AU_PER_LY * pxPerAu };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- scaleBar`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/edu/scaleBar.ts tests/edu/scaleBar.test.ts
git -c commit.gpgsign=false commit -m "feat: add scaleBarFor (zoom-linked scale-bar distance + width)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: ScaleBar（左下の縮尺バー・DOM）

**Files:**
- Create: `src/ui/ScaleBar.ts`
- Test: `tests/ui/scaleBar.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `class ScaleBar { constructor(root: HTMLElement); update(bar: { label: string; widthPx: number }): void }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/scaleBar.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ScaleBar } from '../../src/ui/ScaleBar';

describe('ScaleBar', () => {
  it('renders the label and sets the bar width', () => {
    const root = document.createElement('div');
    const b = new ScaleBar(root);
    b.update({ label: '10 AU ≈ 15億km（光で83分）', widthPx: 120 });
    expect(root.textContent).toContain('10 AU');
    const line = root.querySelectorAll('div')[1] as HTMLDivElement; // wrap > [line, label]
    expect(line.style.width).toBe('120px');
  });
  it('does not block clicks (pointer-events:none)', () => {
    const root = document.createElement('div');
    new ScaleBar(root);
    const wrap = root.querySelector('div') as HTMLDivElement;
    expect(wrap.style.pointerEvents).toBe('none');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- "ui/scaleBar"`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 実装**

`src/ui/ScaleBar.ts`:
```ts
export class ScaleBar {
  private readonly line: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private lastKey = '';

  constructor(root: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;left:16px;bottom:16px;color:#eaf2ff;font:12px system-ui,sans-serif;' +
      'text-shadow:0 0 3px #000;pointer-events:none;';
    this.line = document.createElement('div');
    this.line.style.cssText =
      'height:8px;border-left:2px solid #eaf2ff;border-right:2px solid #eaf2ff;' +
      'border-bottom:2px solid #eaf2ff;box-sizing:border-box;';
    this.label = document.createElement('div');
    this.label.style.marginTop = '3px';
    wrap.append(this.line, this.label);
    root.appendChild(wrap);
  }

  update(bar: { label: string; widthPx: number }): void {
    const key = `${bar.label}|${Math.round(bar.widthPx)}`;
    if (key === this.lastKey) return; // 内容不変なら DOM 操作を省く（毎フレーム呼ばれる）
    this.lastKey = key;
    this.line.style.width = `${bar.widthPx}px`;
    this.label.textContent = bar.label;
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- "ui/scaleBar"`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/ui/ScaleBar.ts tests/ui/scaleBar.test.ts
git -c commit.gpgsign=false commit -m "feat: add ScaleBar (bottom-left scale-bar DOM)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: scaleInfo に localgroup 段を追加

**Files:**
- Modify: `src/edu/scaleInfo.ts`
- Test: `tests/edu/scaleInfo.test.ts`（既存に追記）

**Interfaces:**
- Consumes: なし
- Produces: `scaleInfoFor` が `viewDistanceAu >= 1e10` で `stage: 'localgroup'` を返す。`ScaleInfo.stage` に `'localgroup'` を追加。

- [ ] **Step 1: 失敗するテストを追記**

`tests/edu/scaleInfo.test.ts` の末尾に追記:
```ts
describe('scaleInfoFor local group', () => {
  it('enters localgroup at 1e10 AU and mentions the Andromeda distance', () => {
    expect(scaleInfoFor(5e9).stage).toBe('galaxy');
    const info = scaleInfoFor(1e10);
    expect(info.stage).toBe('localgroup');
    expect(info.title).toBe('局部銀河群');
    expect(info.lines.join(' ')).toMatch(/250万光年/);
  });
});
```
（`scaleInfoFor` は既存 import 済み。無ければ先頭 import に追加。）

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- scaleInfo`
Expected: FAIL（1e10 が galaxy を返す / localgroup 未定義）

- [ ] **Step 3: 実装**

`src/edu/scaleInfo.ts`:
1. `ScaleInfo` の stage 型に `'localgroup'` を追加:
```ts
export interface ScaleInfo {
  stage: 'solar' | 'interstellar' | 'galaxy' | 'localgroup';
  title: string;
  lines: string[];
}
```
2. 定数を追加（既存 `const GALAXY_MIN_AU = 1_000_000;` の下）:
```ts
const LOCALGROUP_MIN_AU = 1e10;
```
3. `scaleInfoFor` の関数本体の**先頭**（既存の `if (viewDistanceAu >= GALAXY_MIN_AU)` より前）に追加:
```ts
  if (viewDistanceAu >= LOCALGROUP_MIN_AU) {
    return {
      stage: 'localgroup',
      title: '局部銀河群',
      lines: [
        '銀河が 約50個 集まった なかま',
        '天の川銀河とアンドロメダ銀河は 約250万光年',
        '光でも 250万年 かかる きょり',
      ],
    };
  }
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- scaleInfo`
Expected: PASS（既存 + 新規。既存の `scaleInfoFor(2_000_000)==='galaxy'` 等は 2e6<1e10 で不変）

- [ ] **Step 5: コミット**

```bash
git add src/edu/scaleInfo.ts tests/edu/scaleInfo.test.ts
git -c commit.gpgsign=false commit -m "feat: add localgroup (Andromeda) scale stage" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: LocalGroupDiagram（局部銀河群 模式図・DOM）

**Files:**
- Create: `src/ui/LocalGroupDiagram.ts`
- Test: `tests/ui/localGroupDiagram.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `class LocalGroupDiagram { constructor(root: HTMLElement); setVisible(v: boolean): void }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/localGroupDiagram.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { LocalGroupDiagram } from '../../src/ui/LocalGroupDiagram';

describe('LocalGroupDiagram', () => {
  it('contains the two galaxies, distance and current-location marker', () => {
    const root = document.createElement('div');
    new LocalGroupDiagram(root);
    const t = root.textContent ?? '';
    expect(t).toContain('天の川銀河');
    expect(t).toContain('アンドロメダ');
    expect(t).toContain('約250万光年');
    expect(t).toContain('現在地');
  });
  it('is hidden by default and toggles with setVisible', () => {
    const root = document.createElement('div');
    const d = new LocalGroupDiagram(root);
    const wrap = root.querySelector('div') as HTMLDivElement;
    expect(wrap.style.display).toBe('none');
    d.setVisible(true);
    expect(wrap.style.display).toBe('block');
    d.setVisible(false);
    expect(wrap.style.display).toBe('none');
  });
  it('does not block clicks (pointer-events:none)', () => {
    const root = document.createElement('div');
    new LocalGroupDiagram(root);
    expect((root.querySelector('div') as HTMLDivElement).style.pointerEvents).toBe('none');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- localGroupDiagram`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 実装**

`src/ui/LocalGroupDiagram.ts`:
```ts
export class LocalGroupDiagram {
  private readonly wrap: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.wrap = document.createElement('div');
    this.wrap.style.cssText =
      'position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);display:none;' +
      'color:#eaf2ff;font:13px system-ui,sans-serif;text-align:center;pointer-events:none;' +
      'text-shadow:0 0 4px #000;';
    // 静的リテラルのみ（外部データ非注入なので innerHTML でも XSS なし）
    this.wrap.innerHTML =
      '<div style="font-size:15px;font-weight:600;color:#bcd7ff;margin-bottom:16px">【局部銀河群】</div>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:12px">' +
        '<div>' +
          '<div style="width:70px;height:34px;border-radius:50%;background:radial-gradient(circle,#cfe0ff,#4a6ea5);margin:0 auto"></div>' +
          '<div style="margin-top:6px">天の川銀河</div>' +
          '<div style="color:#ffd479">↑現在地（太陽系）</div>' +
        '</div>' +
        '<div style="flex:1;min-width:120px">' +
          '<div style="border-top:1px solid #9fb6d6"></div>' +
          '<div style="margin-top:4px">約250万光年</div>' +
        '</div>' +
        '<div>' +
          '<div style="width:80px;height:40px;border-radius:50%;background:radial-gradient(circle,#e6d5ff,#7a5aa5);margin:0 auto"></div>' +
          '<div style="margin-top:6px">アンドロメダ銀河<br>（M31）</div>' +
        '</div>' +
      '</div>';
    root.appendChild(this.wrap);
  }

  setVisible(v: boolean): void {
    this.wrap.style.display = v ? 'block' : 'none';
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- localGroupDiagram`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/ui/LocalGroupDiagram.ts tests/ui/localGroupDiagram.test.ts
git -c commit.gpgsign=false commit -m "feat: add LocalGroupDiagram (Milky Way / Andromeda schematic)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: app.ts 結線（縮尺バー + 局部銀河群 + ラベル条件）

**Files:**
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `scaleBarFor`（Task 1）, `ScaleBar`（Task 2）, `LocalGroupDiagram`（Task 4）, 既存 `scaleInfo`（`scaleInfoFor` の結果）, `nav.viewDistanceAu`, `engine.camera.fov`, `engine.renderer.domElement.clientHeight`
- Produces: 挙動のみ（app は単体テストなし）

**この Task の検証:** ハードゲートは `npx tsc --noEmit` クリーン + `npm run build` 成功 + `npm test` 全緑。バー・模式図・段切替はコントローラが Playwright で実施。

**受入基準（目視）:**
1. 太陽系ビュー: 左下に縮尺バー（例「5 AU ≈ 7.5億km（光で42分）」）。ズームで値が変化。
2. 銀河ズーム: 縮尺バーが「○ 光年」に切替。星名ラベルは出ない。
3. さらにズームアウトで局部銀河群段に入り、中央に模式図（天の川銀河 ⊕現在地 ─約250万光年─ アンドロメダ M31）。縮尺バーは「○万光年」。左上パネルも局部銀河群。
4. すべてクリック・既存パネルを妨げない。

- [ ] **Step 1: import を追加**

`src/app.ts` の import 群に追加:
```ts
import { scaleBarFor } from './edu/scaleBar';
import { ScaleBar } from './ui/ScaleBar';
import { LocalGroupDiagram } from './ui/LocalGroupDiagram';
```

- [ ] **Step 2: ScaleBar と LocalGroupDiagram を生成**

`const scalePanel = new ScalePanel(root);` の直後に追加:
```ts
  const scaleBar = new ScaleBar(root);
  const localGroup = new LocalGroupDiagram(root);
```

- [ ] **Step 3: frame ループで更新 + ラベル条件更新**

frame ループ内、既存の `scalePanel.update(scaleInfo);` の直後に追加:
```ts
    scaleBar.update(scaleBarFor(
      nav.viewDistanceAu,
      engine.renderer.domElement.clientHeight,
      engine.camera.fov * Math.PI / 180,
    ));
    localGroup.setVisible(scaleInfo.stage === 'localgroup');
```
（`scaleInfo` は同ループ内で既に計算済み。無ければ `const scaleInfo = scaleInfoFor(nav.viewDistanceAu);` の直後に置く。）

さらに、既存の星名ラベル分岐を localgroup でも省略するよう変更する。現在:
```ts
    } else if (scaleInfo.stage !== 'galaxy') {
```
を次に変更（ブロック中身は不変）:
```ts
    } else if (scaleInfo.stage !== 'galaxy' && scaleInfo.stage !== 'localgroup') {
```

- [ ] **Step 4: 型チェック / ビルド / テスト**

Run: `npx tsc --noEmit` → クリーン。`npm run build`（監査 hook 時 `# CLAUDE_AUDIT_OK`）→ 成功。`npm test` → 全緑（app は単体なし）。

- [ ] **Step 5: コミット**

```bash
git add src/app.ts
git -c commit.gpgsign=false commit -m "feat: wire scale bar + local group diagram + omit labels at localgroup" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review（計画作成者による点検結果）

**1. Spec coverage:**
- 縮尺バー（左下・ズーム連動・AU/光年/万光年・光での時間）: Task 1 + Task 2 + Task 5 ✓
- 局部銀河群段（viewDistanceAu>=1e10）: Task 3 ✓
- アンドロメダ模式図（2銀河＋250万光年＋現在地）: Task 4 + Task 5（可視制御）✓
- 星名ラベルを galaxy に加え localgroup でも省略: Task 5 ✓
- テスト（縮尺計算・段判定・DOM）: Task 1,3,2,4 ✓

**2. Placeholder scan:** 全ステップに実コード。TBD/TODO なし。

**3. Type consistency:**
- `scaleBarFor(viewDistanceAu, screenHeightPx, fovYRad) → {label,widthPx}` は Task 1 定義を Task 5 が使用、一致。`ScaleBar.update({label,widthPx})` は Task 2、Task 5 が使用、`scaleBarFor` の戻り値と一致。
- `scaleInfoFor` の戻り `stage` に `'localgroup'` を Task 3 で追加、Task 5 が `=== 'localgroup'` / `!== 'localgroup'` で使用、一致。
- `LocalGroupDiagram.setVisible(boolean)` は Task 4、Task 5 が使用、一致。
- `AU_IN_OKUKM` は既存 export、Task 1 が使用。

**4. 回帰リスク:** 追加は新規 3 モジュール + app.ts への追記（バー/図の更新）+ ラベル条件の `!==`1つ追加。既存の描画・選択・フォーカス・フェード・スケールパネル・惑星/星ラベル（solar/interstellar）は不変。localgroup は既存 galaxy より上流で判定するため既存段テストは不変。全オーバーレイ `pointer-events:none`。コントローラが Playwright で段切替・バー・図・クリック非干渉を確認。

---

## 実行方式

**Subagent-Driven** 推奨。純粋（Task 1,3）・DOM（Task 2,4）は完全コード転記 + TDD で標準〜cheap モデル、app.ts 結線（Task 5）は標準モデル。Task 5 後にコントローラが Playwright で縮尺バーの単位切替（AU→光年→万光年）・局部銀河群の模式図・段切替・クリック非干渉を検証。
