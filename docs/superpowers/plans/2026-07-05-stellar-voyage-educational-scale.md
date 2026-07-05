# stellar-voyage 教育スケールパネル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ズームアウトに応じて「太陽系 / 太陽系の外 / 天の川銀河」のスケール名・端から端の距離・光でどれくらいかかるかを左上パネルに常時表示し、銀河スケールでは星名ラベルを省く。

**Architecture:** 純粋関数 `scaleInfoFor(viewDistanceAu)` が 3 ステージと教育コンテンツ（title + lines）を返し、DOM の `ScalePanel` が表示。`app.ts` が毎フレーム更新し、`stage === 'galaxy'` のとき近傍星ラベルをスキップ。光速換算は `1 AU = 8.317 光分`。

**Tech Stack:** TypeScript 5.9、Three.js（本機能は Three 非依存の純粋ロジック＋DOM）、Vite 7、vitest 3。追加ランタイム依存なし。

## Global Constraints

- 全ユーザー向け文言は**日本語**、小学生が読める平易な表現。ワールド単位 **AU**。
- TS strict + `noUncheckedIndexedAccess` ON（配列添字は `!`）。ランタイム依存は Three.js のみ、`"type":"module"`。
- テストは vitest（既定 jsdom）。純粋ロジックは単体。パネル表示・銀河ラベル省略は Playwright 目視（コントローラ）。
- コミットはタスク単位。末尾に `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。署名エラー時は `git -c commit.gpgsign=false commit`、`--no-verify` は使わない。
- ビルド系 (`npm run build`) は監査 hook 発火時に末尾 `# CLAUDE_AUDIT_OK`（変更が test 済み・隔離済みの場合）。

## 既存モジュール（依存/改修）

- `src/ui/format.ts`: `AU_IN_OKUKM = 1.496`（1 AU の億km 換算、既存 export）
- `src/app.ts`: frame ループ内で `nav.viewDistanceAu`、`fade = systemFade(nav.viewDistanceAu)` が利用可能。ラベル分岐 `if (fade > 0.5) { 系ラベル } else { 近傍星ラベル }` が既存。`root`、`engine.render()`、`labels.render(...)` が既存。

## File Structure

```
src/edu/scaleInfo.ts        # 新規（純粋）: formatLightTime + scaleInfoFor
src/ui/ScalePanel.ts        # 新規（DOM）: 左上スケールパネル
src/app.ts                  # 改修: ScalePanel 結線 + galaxy ラベル省略
tests/edu/scaleInfo.test.ts # 新規
tests/ui/scalePanel.test.ts # 新規
```

---

### Task 1: scaleInfo（光速換算 + スケール判定・純粋）

**Files:**
- Create: `src/edu/scaleInfo.ts`
- Test: `tests/edu/scaleInfo.test.ts`

**Interfaces:**
- Consumes: `AU_IN_OKUKM`（ui/format）
- Produces:
  - `formatLightTime(lightMinutes: number): string`（秒/分/時間/日/年）
  - `interface ScaleInfo { stage: 'solar' | 'interstellar' | 'galaxy'; title: string; lines: string[] }`
  - `scaleInfoFor(viewDistanceAu: number): ScaleInfo`

- [ ] **Step 1: 失敗するテストを書く**

`tests/edu/scaleInfo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatLightTime, scaleInfoFor } from '../../src/edu/scaleInfo';

describe('formatLightTime', () => {
  it('formats the Earth–Sun light time as 8分19秒', () => {
    expect(formatLightTime(8.317)).toBe('8分19秒');
  });
  it('handles seconds, hours and years ranges', () => {
    expect(formatLightTime(0.5)).toBe('30秒');
    expect(formatLightTime(500)).toBe('約8時間');
    expect(formatLightTime(60 * 24 * 400)).toMatch(/約.*年/);
  });
});

describe('scaleInfoFor', () => {
  it('is the solar stage below 30000 AU with edge-to-edge facts', () => {
    const info = scaleInfoFor(40);
    expect(info.stage).toBe('solar');
    expect(info.title).toBe('太陽系');
    const joined = info.lines.join(' ');
    expect(joined).toMatch(/90億km/);
    expect(joined).toMatch(/約8時間/);
    expect(joined).toMatch(/8分19秒/);
  });
  it('switches solar→interstellar at 30000 AU and →galaxy at 1e6 AU', () => {
    expect(scaleInfoFor(29999).stage).toBe('solar');
    expect(scaleInfoFor(30000).stage).toBe('interstellar');
    expect(scaleInfoFor(1_000_000).stage).toBe('galaxy');
  });
  it('interstellar cites the nearest star in light-years; galaxy cites 10万光年', () => {
    expect(scaleInfoFor(100000).lines.join(' ')).toMatch(/約4\.2年/);
    expect(scaleInfoFor(2_000_000).lines.join(' ')).toMatch(/10万光年/);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- scaleInfo`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 実装**

`src/edu/scaleInfo.ts`:
```ts
import { AU_IN_OKUKM } from '../ui/format';

const LIGHT_MIN_PER_AU = 8.317;   // 1 AU を光が進む時間（分）
const NEPTUNE_ORBIT_AU = 30.1;    // 海王星の軌道長半径（solarSystem.ts と一致）
const SOLAR_MAX_AU = 30000;       // 太陽系ステージの上限（フェード帯の上端）
const GALAXY_MIN_AU = 1_000_000;  // 銀河ステージの下限

export function formatLightTime(lightMinutes: number): string {
  if (lightMinutes < 1) return `${Math.round(lightMinutes * 60)}秒`;
  if (lightMinutes < 60) {
    const m = Math.floor(lightMinutes);
    const s = Math.round((lightMinutes - m) * 60);
    return s > 0 ? `${m}分${s}秒` : `${m}分`;
  }
  if (lightMinutes < 60 * 24) return `約${Math.round(lightMinutes / 60)}時間`;
  if (lightMinutes < 60 * 24 * 365) return `約${Math.round(lightMinutes / 60 / 24)}日`;
  return `約${(lightMinutes / 60 / 24 / 365).toPrecision(2)}年`;
}

export interface ScaleInfo {
  stage: 'solar' | 'interstellar' | 'galaxy';
  title: string;
  lines: string[];
}

export function scaleInfoFor(viewDistanceAu: number): ScaleInfo {
  if (viewDistanceAu >= GALAXY_MIN_AU) {
    return {
      stage: 'galaxy',
      title: '天の川銀河',
      lines: ['星の数 約2000億個', '端から端 約10万光年（光でも10万年）', '太陽もこの中のひとつ'],
    };
  }
  if (viewDistanceAu >= SOLAR_MAX_AU) {
    return {
      stage: 'interstellar',
      title: '太陽系の外へ',
      lines: ['太陽系はこんなに小さい！', 'いちばん近い星まで 光で 約4.2年', '光は1秒で地球を7周半'],
    };
  }
  const edgeAu = NEPTUNE_ORBIT_AU * 2; // 端から端＝海王星軌道の直径
  const edgeOkm = Math.round(edgeAu * AU_IN_OKUKM);
  return {
    stage: 'solar',
    title: '太陽系',
    lines: [
      `端から端: 約${edgeOkm}億km（海王星の軌道）`,
      `光でも 端から端まで ${formatLightTime(edgeAu * LIGHT_MIN_PER_AU)}`,
      `地球から太陽まで 光で ${formatLightTime(1.0 * LIGHT_MIN_PER_AU)}`,
    ],
  };
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- scaleInfo`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/edu/scaleInfo.ts tests/edu/scaleInfo.test.ts
git -c commit.gpgsign=false commit -m "feat: add scaleInfo (light-time + zoom scale stages)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: ScalePanel（左上の教育パネル・DOM）

**Files:**
- Create: `src/ui/ScalePanel.ts`
- Test: `tests/ui/scalePanel.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `class ScalePanel { constructor(root: HTMLElement); update(info: { title: string; lines: string[] }): void }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/scalePanel.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ScalePanel } from '../../src/ui/ScalePanel';

describe('ScalePanel', () => {
  it('renders the title in 【】 and every line', () => {
    const root = document.createElement('div');
    const p = new ScalePanel(root);
    p.update({ title: '太陽系', lines: ['端から端 約90億km', '光でも約8時間'] });
    expect(root.textContent).toContain('【太陽系】');
    expect(root.textContent).toContain('端から端 約90億km');
    expect(root.textContent).toContain('光でも約8時間');
  });
  it('updates the title when the stage changes', () => {
    const root = document.createElement('div');
    const p = new ScalePanel(root);
    p.update({ title: '太陽系', lines: ['a'] });
    p.update({ title: '天の川銀河', lines: ['星の数 約2000億個'] });
    expect(root.textContent).toContain('【天の川銀河】');
    expect(root.textContent).not.toContain('【太陽系】');
    expect(root.textContent).toContain('星の数 約2000億個');
  });
  it('does not block clicks (pointer-events:none)', () => {
    const root = document.createElement('div');
    new ScalePanel(root);
    const panel = root.querySelector('div') as HTMLDivElement;
    expect(panel.style.pointerEvents).toBe('none');
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- scalePanel`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 実装**

`src/ui/ScalePanel.ts`:
```ts
export class ScalePanel {
  private readonly titleEl: HTMLDivElement;
  private readonly bodyEl: HTMLDivElement;
  private readonly lineEls: HTMLDivElement[] = [];
  private lastKey = '';

  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;left:16px;top:16px;min-width:200px;max-width:min(320px,60vw);' +
      'color:#eaf2ff;background:rgba(8,14,28,0.82);border:1px solid #2b4a7a;border-radius:8px;' +
      'padding:12px 16px;font:13px/1.7 system-ui,sans-serif;pointer-events:none;';
    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = 'font-size:15px;font-weight:600;margin-bottom:4px;color:#bcd7ff;';
    this.bodyEl = document.createElement('div');
    el.append(this.titleEl, this.bodyEl);
    root.appendChild(el);
  }

  update(info: { title: string; lines: string[] }): void {
    const key = info.title + '\n' + info.lines.join('\n');
    if (key === this.lastKey) return; // 内容不変なら DOM 操作を省く（毎フレーム呼ばれる）
    this.lastKey = key;
    this.titleEl.textContent = `【${info.title}】`;
    for (let i = 0; i < info.lines.length; i++) {
      let d = this.lineEls[i];
      if (!d) { d = document.createElement('div'); this.bodyEl.appendChild(d); this.lineEls[i] = d; }
      d.textContent = info.lines[i]!;
      d.style.display = 'block';
    }
    for (let i = info.lines.length; i < this.lineEls.length; i++) this.lineEls[i]!.style.display = 'none';
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- scalePanel`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/ui/ScalePanel.ts tests/ui/scalePanel.test.ts
git -c commit.gpgsign=false commit -m "feat: add ScalePanel (top-left educational scale panel)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: app.ts 結線（毎フレーム更新 + 銀河ラベル省略）

**Files:**
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `ScalePanel`（Task 2）, `scaleInfoFor`（Task 1）, 既存 `nav.viewDistanceAu`/`fade`/`root`/ラベル分岐
- Produces: 挙動のみ（app は単体テストなし）

**この Task の検証:** ハードゲートは `npx tsc --noEmit` クリーン + `npm run build` 成功 + `npm test` 全緑。パネル表示・ステージ切替・銀河ラベル省略はコントローラが Playwright で実施。

**受入基準（目視）:**
1. 太陽系ビューで左上に【太陽系】パネル（端から端 約90億km / 光でも約8時間 / 地球は光で8分19秒）。
2. ズームアウトで【太陽系の外へ】（最も近い星まで光で約4.2年）に変わり、近傍星の名前ラベルは見える。
3. さらにズームアウトで【天の川銀河】に変わり、星名ラベルが消える（星の点は残る）。
4. パネルはクリックや右上パネルを妨げない。

- [ ] **Step 1: import を追加**

`src/app.ts` の import 群に追加:
```ts
import { ScalePanel } from './ui/ScalePanel';
import { scaleInfoFor } from './edu/scaleInfo';
```

- [ ] **Step 2: ScalePanel を生成**

`const labels = new LabelLayer(root);` の直後に追加:
```ts
  const scalePanel = new ScalePanel(root);
```

- [ ] **Step 3: frame ループでスケール更新 + 銀河ラベル省略**

frame ループ内、ラベル構築ブロック（`const labelItems: LabelItem[] = [];` で始まる部分）の**直前**にスケール計算とパネル更新を追加:
```ts
    const scaleInfo = scaleInfoFor(nav.viewDistanceAu);
    scalePanel.update(scaleInfo);
```
そして、既存のラベル分岐の `else` を、galaxy ステージで星名ラベルを描かないよう変更する。現在:
```ts
    if (fade > 0.5) {
      // 系ラベル …
    } else {
      // 近傍星ラベル …
    }
```
の `} else {` を次に変更（ブロック中身は不変）:
```ts
    } else if (scaleInfo.stage !== 'galaxy') {
```
（galaxy ステージでは `labelItems` が空のまま → `labels.render` が全ラベルを隠す。StarField の星の点は不変。）

- [ ] **Step 4: 型チェック / ビルド / テスト**

Run: `npx tsc --noEmit` → クリーン。`npm run build`（監査 hook 時 `# CLAUDE_AUDIT_OK`）→ 成功。`npm test` → 全緑（既存 + 新規、app は単体なし）。

- [ ] **Step 5: コミット**

```bash
git add src/app.ts
git -c commit.gpgsign=false commit -m "feat: wire ScalePanel + omit star labels at galaxy scale" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Self-Review（計画作成者による点検結果）

**1. Spec coverage:**
- スケール連動パネル（左上・ズームで内容変化）: Task 2 + Task 3 ✓
- 光速換算（光で分/時間/年）: Task 1（`formatLightTime`）✓
- 3 ステージ（太陽系/太陽系の外/銀河）+ 各コンテンツ: Task 1（`scaleInfoFor`）✓
- 太陽系の端＝海王星軌道（約90億km・光で約8時間）: Task 1 ✓
- 銀河スケールで星名ラベル省略: Task 3 ✓
- テスト（光速換算・ステージ判定・パネル表示）: Task 1, 2 ✓

**2. Placeholder scan:** 全ステップに実コード。TBD/TODO なし。

**3. Type consistency:**
- `formatLightTime(number)→string` / `scaleInfoFor(number)→ScaleInfo{stage,title,lines}` は Task 1 定義を Task 3 が使用、一致。
- `ScalePanel.update({title,lines})` は Task 2 定義を Task 3 が使用、一致。ScaleInfo は `{title,lines}` を含むので `scalePanel.update(scaleInfo)` は型的に成立。
- `AU_IN_OKUKM` は既存 export、Task 1 が使用。

**4. 回帰リスク:** 追加は新規 2 モジュール + app.ts への追記 1 箇所（パネル更新）+ ラベル分岐の `else`→`else if` 変更 1 箇所。既存の描画・選択・フォーカス・フェード・既存ラベルは不変（galaxy ステージでのみ近傍星ラベルを省く）。パネルは `pointer-events:none`。コントローラが Playwright でステージ切替・銀河ラベル省略・クリック非干渉を確認。

---

## 実行方式

**Subagent-Driven** 推奨。純粋（Task 1）・DOM（Task 2）は完全コード転記 + TDD で標準〜cheap モデル、app.ts 結線（Task 3）は標準モデル。Task 3 後にコントローラが Playwright でステージ切替（太陽系→太陽系の外→銀河）・パネル文言・銀河ラベル省略・クリック非干渉を検証。
