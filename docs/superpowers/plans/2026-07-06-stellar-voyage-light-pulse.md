# 光速パルス（光の遅さ体感）実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「💡 光を放つ」ボタンで中心星から光の波紋を発射し、経過時間カウンタで「光速でも宇宙では遅い」を全スケール連動で体感させる。

**Architecture:** 波紋の成長速度は現在の viewDistance に比例（画面基準で一定テンポ）、経過時間カウンタは実光行時間（半径÷光速）を表示。純粋ロジック（成長速度・光行時間・到達判定）を `src/edu/lightPulse.ts` に切り出し TDD、描画（Three.js 球）と UI（ボタン・カウンタ）は薄い構造テスト＋実機調整、app.ts で結線し Playwright E2E 検証。

**Tech Stack:** Vite + TypeScript + Three.js + vitest（jsdom）。

## Global Constraints

- 実装ゾーン分離: **純粋ロジックは TDD 厳密（RED→GREEN）／見た目の数値（色・opacity・`PULSE_SPEED_FRACTION`・配置 px・球の分割数）はテストで assert しない**（コントローラが Playwright で目視調整）。描画/UI コンポーネントは構造的不変条件のみテスト。
- `LIGHT_MIN_PER_AU = 8.317`（1 AU の光行時間・分。既存 `src/edu/scaleInfo.ts` と同値）。
- 経過時間の整形は既存 `formatLightTime`（`scaleInfo.ts` から export 済み）を再利用し、1万年以上のみ「約N万年」に拡張。
- コミット: `git -c commit.gpgsign=false commit`、メッセージ末尾に `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。`--no-verify` 禁止。
- テスト: `npx vitest run <path>`（個別）/ `npm test`（全体）。型: `npx tsc --noEmit`。dev: `npm run dev` → `http://localhost:5180`。
- `npm run build` は監査 hook が発火する。test 済み・隔離済みなら末尾に `# CLAUDE_AUDIT_OK` を付けて再実行してよい。
- 既存機能（惑星公転アニメ・クリック選択・ラベル・4段スケール・pause）に無回帰であること。

---

### Task 1: 純粋ロジック `lightPulse.ts`（TDD 厳密）

**Files:**
- Create: `src/edu/lightPulse.ts`
- Test: `tests/edu/lightPulse.test.ts`

**Interfaces:**
- Consumes: `formatLightTime(lightMinutes: number): string`（`src/edu/scaleInfo.ts` から、export 済み）。
- Produces:
  - `pulseGrowthAuPerSec(viewDistanceAu: number): number`
  - `pulseLightTimeMin(radiusAu: number): number`
  - `formatPulseTime(lightMinutes: number): string`
  - `pulseReached(radiusAu: number, targetAu: number): boolean`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/edu/lightPulse.test.ts
import { describe, it, expect } from 'vitest';
import { pulseGrowthAuPerSec, pulseLightTimeMin, formatPulseTime, pulseReached } from '../../src/edu/lightPulse';

describe('pulseGrowthAuPerSec', () => {
  it('is positive and proportional to view distance (constant screen tempo)', () => {
    expect(pulseGrowthAuPerSec(10)).toBeGreaterThan(0);
    expect(pulseGrowthAuPerSec(100)).toBeGreaterThan(pulseGrowthAuPerSec(10));
    // 画面基準で一定に見えるよう視距離に比例（10倍の視距離→10倍の速度）
    expect(pulseGrowthAuPerSec(100)).toBeCloseTo(pulseGrowthAuPerSec(10) * 10, 5);
  });
});

describe('pulseLightTimeMin', () => {
  it('is 8.317 min at 1 AU and proportional to radius', () => {
    expect(pulseLightTimeMin(1)).toBeCloseTo(8.317, 3);
    expect(pulseLightTimeMin(2)).toBeCloseTo(pulseLightTimeMin(1) * 2, 5);
    expect(pulseLightTimeMin(0)).toBe(0);
  });
});

describe('formatPulseTime', () => {
  it('reuses formatLightTime below 1万年 and switches to 万年 above', () => {
    expect(formatPulseTime(pulseLightTimeMin(1))).toBe('8分19秒');       // 地球=1AU
    const fourLyMin = 4.2 * 365 * 24 * 60;                                // 4.2光年ぶんの光行時間(分)
    expect(formatPulseTime(fourLyMin)).toMatch(/約4\.2年/);
    const hundredThousandYrMin = 100000 * 365 * 24 * 60;
    expect(formatPulseTime(hundredThousandYrMin)).toBe('約10万年');
  });
});

describe('pulseReached', () => {
  it('is true when radius reaches or exceeds the target (inclusive)', () => {
    expect(pulseReached(5, 5)).toBe(true);
    expect(pulseReached(4.9, 5)).toBe(false);
    expect(pulseReached(6, 5)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/edu/lightPulse.test.ts`
Expected: FAIL（`lightPulse` モジュール未作成でインポート解決不可）

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/edu/lightPulse.ts
import { formatLightTime } from './scaleInfo';

// 1 AU を光が進む時間（分・scaleInfo と同値）
const LIGHT_MIN_PER_AU = 8.317;
// 波紋が realtime 1秒で現在ビューの何割広がるか（見た目テンポ・実機調整）
const PULSE_SPEED_FRACTION = 0.35;

// 波紋の成長速度(AU/秒)。どのスケールでも画面上一定テンポに見えるよう現在の視距離に比例させる。
export function pulseGrowthAuPerSec(viewDistanceAu: number): number {
  return PULSE_SPEED_FRACTION * viewDistanceAu;
}

// 半径(AU)を光が進むのにかかる時間(分)。
export function pulseLightTimeMin(radiusAu: number): number {
  return radiusAu * LIGHT_MIN_PER_AU;
}

// 光行時間を人間可読に。1万年以上は「約N万年」に（既存 formatLightTime の指数表記 "約1.0e+5年" を回避）。
export function formatPulseTime(lightMinutes: number): string {
  const years = lightMinutes / (60 * 24 * 365);
  if (years >= 10000) {
    const man = years / 10000;
    return `約${man >= 10 ? Math.round(man) : Number(man.toPrecision(2))}万年`;
  }
  return formatLightTime(lightMinutes);
}

// 波紋が目標距離に届いたか（境界含む）。
export function pulseReached(radiusAu: number, targetAu: number): boolean {
  return radiusAu >= targetAu;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/edu/lightPulse.test.ts`
Expected: PASS（4 describe 全 green）

- [ ] **Step 5: Commit**

```bash
git add src/edu/lightPulse.ts tests/edu/lightPulse.test.ts
git -c commit.gpgsign=false commit -m "feat: 光速パルスの純粋ロジック（成長速度/光行時間/整形/到達判定）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 描画 `LightPulseSphere.ts`（広がる半透明球）

**Files:**
- Create: `src/edu/LightPulseSphere.ts`
- Test: `tests/edu/lightPulseMesh.test.ts`

**Interfaces:**
- Produces: `class LightPulseSphere { readonly object: THREE.Mesh; update(radiusAu: number): void; setVisible(v: boolean): void; dispose(): void }`

**注記（実装ゾーン分離）:** 色・opacity・球の分割数・BackSide/additive は見た目パラメータ＝テストしない。テストは「update が scale に反映」「visibility トグル」「dispose 可能」の構造のみ。

- [ ] **Step 1: Write the failing test**

```typescript
// tests/edu/lightPulseMesh.test.ts
import { describe, it, expect } from 'vitest';
import { LightPulseSphere } from '../../src/edu/LightPulseSphere';

describe('LightPulseSphere', () => {
  it('starts hidden, scales the sphere to the radius, toggles visibility, disposes', () => {
    const p = new LightPulseSphere();
    expect(p.object.visible).toBe(false);
    p.setVisible(true);
    expect(p.object.visible).toBe(true);
    p.update(12);
    expect(p.object.scale.x).toBeCloseTo(12, 5);
    expect(() => p.dispose()).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/edu/lightPulseMesh.test.ts`
Expected: FAIL（`LightPulseSphere` 未作成）

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/edu/LightPulseSphere.ts
import * as THREE from 'three';

// 光の波紋（中心星＝原点から広がる半透明球）。半径(AU)は光速×経過時間で app が駆動する。
export class LightPulseSphere {
  readonly object: THREE.Mesh;
  private readonly material: THREE.MeshBasicMaterial;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      color: 0xfff2cc, transparent: true, opacity: 0.16,
      side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.object = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), this.material);
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  update(radiusAu: number): void {
    this.object.scale.setScalar(Math.max(radiusAu, 1e-6));
  }
  setVisible(v: boolean): void { this.object.visible = v; }
  dispose(): void { this.object.geometry.dispose(); this.material.dispose(); }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/edu/lightPulseMesh.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/edu/LightPulseSphere.ts tests/edu/lightPulseMesh.test.ts
git -c commit.gpgsign=false commit -m "feat: 光速パルスの描画球（広がる半透明球）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `EmitButton.ts`（光を放つボタン）

**Files:**
- Create: `src/ui/EmitButton.ts`
- Test: `tests/ui/emitButton.test.ts`

**Interfaces:**
- Produces: `class EmitButton { constructor(root: HTMLElement, onEmit: () => void) }`

**注記:** 配置 px・文言・色は見た目＝テストしない。テストは「click で onEmit 発火」のみ。`pointerdown`/`click` の `stopPropagation` は PauseButton と同じくキャンバスのクリック選択との干渉を防ぐため必須。

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/emitButton.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EmitButton } from '../../src/ui/EmitButton';

describe('EmitButton', () => {
  it('fires onEmit exactly once per click', () => {
    const root = document.createElement('div');
    const onEmit = vi.fn();
    new EmitButton(root, onEmit);
    root.querySelector('button')!.click();
    expect(onEmit).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/emitButton.test.ts`
Expected: FAIL（`EmitButton` 未作成）

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/ui/EmitButton.ts
// 「光を放つ」ボタン。PauseButton と同じ流儀（fixed 配置・pointerdown/click stopPropagation で
// キャンバスのクリック選択と干渉させない）。bottom は停止ボタン(64px)の上に重ねない位置。
export class EmitButton {
  private readonly btn: HTMLButtonElement;
  constructor(root: HTMLElement, onEmit: () => void) {
    this.btn = document.createElement('button');
    this.btn.textContent = '💡 光を放つ';
    this.btn.style.cssText =
      'position:fixed;left:50%;bottom:104px;transform:translateX(-50%);' +
      'padding:6px 14px;border:1px solid #6a5a2a;border-radius:6px;' +
      'background:rgba(28,24,12,0.8);color:#fff2cc;font:13px system-ui,sans-serif;' +
      'cursor:pointer;text-shadow:0 0 4px #000;';
    this.btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btn.addEventListener('click', (e) => { e.stopPropagation(); onEmit(); });
    root.appendChild(this.btn);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/emitButton.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/EmitButton.ts tests/ui/emitButton.test.ts
git -c commit.gpgsign=false commit -m "feat: 光を放つボタン（EmitButton）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `PulseReadout.ts`（経過時間カウンタ）

**Files:**
- Create: `src/ui/PulseReadout.ts`
- Test: `tests/ui/pulseReadout.test.ts`

**Interfaces:**
- Produces: `class PulseReadout { constructor(root: HTMLElement); update(text: string): void; hide(): void }`

**注記:** 配置 px・色は見た目＝テストしない。`pointer-events:none` はクリック非干渉のため必須。テストは「update で表示＋テキスト反映」「hide で非表示」の構造のみ。

- [ ] **Step 1: Write the failing test**

```typescript
// tests/ui/pulseReadout.test.ts
import { describe, it, expect } from 'vitest';
import { PulseReadout } from '../../src/ui/PulseReadout';

describe('PulseReadout', () => {
  it('is hidden initially, shows text on update, hides on hide', () => {
    const root = document.createElement('div');
    const r = new PulseReadout(root);
    const el = root.querySelector('div')!;
    expect(el.style.display).toBe('none');
    r.update('光の経過時間: 8分19秒');
    expect(el.textContent).toBe('光の経過時間: 8分19秒');
    expect(el.style.display).toBe('block');
    r.hide();
    expect(el.style.display).toBe('none');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ui/pulseReadout.test.ts`
Expected: FAIL（`PulseReadout` 未作成）

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/ui/PulseReadout.ts
// 光の経過時間カウンタ（下部中央・ScalePanel 流儀の DOM オーバーレイ・クリック非干渉）。
export class PulseReadout {
  private readonly el: HTMLDivElement;
  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;left:50%;bottom:140px;transform:translateX(-50%);' +
      'color:#fff2cc;background:rgba(8,14,28,0.82);border:1px solid #6a5a2a;border-radius:6px;' +
      'padding:6px 14px;font:13px system-ui,sans-serif;text-shadow:0 0 4px #000;' +
      'pointer-events:none;display:none;white-space:nowrap;';
    root.appendChild(this.el);
  }
  update(text: string): void { this.el.textContent = text; this.el.style.display = 'block'; }
  hide(): void { this.el.style.display = 'none'; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ui/pulseReadout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui/PulseReadout.ts tests/ui/pulseReadout.test.ts
git -c commit.gpgsign=false commit -m "feat: 光の経過時間カウンタ（PulseReadout）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: app.ts 結線 ＋ Playwright E2E（統合・コントローラ実施）

**Files:**
- Modify: `src/app.ts`（import 追加 / インスタンス生成 / frame ループに光パルス更新）

**Interfaces:**
- Consumes: Task1 `pulseGrowthAuPerSec`/`pulseLightTimeMin`/`formatPulseTime`/`pulseReached`、Task2 `LightPulseSphere`、Task3 `EmitButton`、Task4 `PulseReadout`、既存 `systemFade`(`./nav/fade`)・`nearestStarsPc`(`./nav/nearestStars`)・`AU_PER_PC`(`./starfield/StarField`)。

**注記:** 統合レイヤは app.ts に単体テストが無い（このプロジェクトのアーキ）。TDD ではなく **Playwright E2E で受入基準を検証**する（他タスクの純粋/構造テストは維持）。

- [ ] **Step 1: import を追加**

`src/app.ts` の import ブロック末尾（`import { PLANET_FACTS, ... } from './system/solarFacts';` の下）に追加:

```typescript
import { LightPulseSphere } from './edu/LightPulseSphere';
import { EmitButton } from './ui/EmitButton';
import { PulseReadout } from './ui/PulseReadout';
import { pulseGrowthAuPerSec, pulseLightTimeMin, formatPulseTime, pulseReached } from './edu/lightPulse';
```

- [ ] **Step 2: インスタンス生成・scene への追加・状態変数**

`const localGroup = new LocalGroup();` の直後（UI 生成群の末尾）に追加。`lightPulse.object` は `engine.scene.add(localGroup.object);`（既存）の並びで scene へ追加する:

```typescript
  const lightPulse = new LightPulseSphere();
  const pulseReadout = new PulseReadout(root);
  let pulseActive = false;
  let pulseRadiusAu = 0;
  new EmitButton(root, () => {
    pulseActive = true;   // 押すたび先頭から再発射
    pulseRadiusAu = 0;
    lightPulse.setVisible(true);
  });
```

そして既存の `engine.scene.add(localGroup.object);` の直後に:

```typescript
  engine.scene.add(lightPulse.object);
```

- [ ] **Step 3: 経過時間＋到達通知のヘルパを frame の手前に定義**

`let last = performance.now();` の直前（`const camAu = new THREE.Vector3();` 付近、frame 定義より前）に追加:

```typescript
  // 光の経過時間 + 到達通知の文言。系ビューでは到達した最遠の惑星、恒星間/銀河では最寄りの他の星まで。
  function pulseReadoutText(radiusAu: number): string {
    const time = formatPulseTime(pulseLightTimeMin(radiusAu));
    let reach = '';
    if (systemFade(nav.viewDistanceAu) > 0.5 && systemScene) {
      let name = '';
      for (const p of currentSystem.planets) {
        if (pulseReached(radiusAu, p.semiMajorAxisAu)) name = p.name;
      }
      if (name) reach = ` ・ ${name}に到達`;
    } else {
      const fp: [number, number, number] = [
        nav.focusWorldAu[0] / AU_PER_PC, nav.focusWorldAu[1] / AU_PER_PC, nav.focusWorldAu[2] / AU_PER_PC,
      ];
      const near = nearestStarsPc(fp, catalog.columns, 2).find((s) => s.index !== nav.focusStarIndex);
      if (near) {
        const targetAu = near.distPc * AU_PER_PC;
        reach = pulseReached(radiusAu, targetAu)
          ? ' ・ 最寄りの星に到達'
          : ` ・ 最寄りの星まで あと ${formatPulseTime(pulseLightTimeMin(targetAu - radiusAu))}`;
      }
    }
    return `光の経過時間: ${time}${reach}`;
  }
```

- [ ] **Step 4: frame ループに光パルス更新を追加**

frame 内、`slider.setReadout(...)` の直後・`engine.render();` の直前に挿入:

```typescript
    // --- 光速パルス（光の遅さを体感） -----------------------------------
    if (pulseActive) {
      if (!paused) pulseRadiusAu += pulseGrowthAuPerSec(nav.viewDistanceAu) * dt;
      if (pulseRadiusAu > nav.viewDistanceAu * 4) {
        // ビューを大きく超えたら自動終了（際限ない成長を防ぐ）
        pulseActive = false;
        lightPulse.setVisible(false);
        pulseReadout.hide();
      } else {
        lightPulse.update(pulseRadiusAu);
        pulseReadout.update(pulseReadoutText(pulseRadiusAu));
      }
    }
```

- [ ] **Step 5: 型チェック・全テスト・ビルド**

Run:
```bash
npx tsc --noEmit
npm test
npm run build   # CLAUDE_AUDIT_OK （純粋/構造は TDD 済み・app.ts 結線はE2Eで検証）
```
Expected: tsc エラー 0 ／ 全テスト pass（Task1–4 の新規テスト含む）／ build 成功。

- [ ] **Step 6: Playwright E2E（コントローラが実機検証）**

`npm run dev`（→ localhost:5180）で以下を確認（`browser_evaluate` で canvas に発射ボタン click / wheel / keydown を dispatch、`browser_take_screenshot`＋`Read` で目視）:
1. 太陽系ビューで「💡 光を放つ」→ 中心（太陽）から光の波紋が広がる（スクショ）。
2. 経過時間カウンタが増える。惑星到達で「○○に到達」（地球到達時に「8分19秒」付近）。
3. ズームアウトして恒星間/銀河で再発射 → カウンタが年/万年単位、「最寄りの星まで あと ○年」表示。**波紋のテンポは一定なのにカウンタは桁違い**（＝設計の肝）を確認。
4. 一時停止（停止ボタン/Space）で波紋が止まり、再開で続く。
5. 既存機能に無回帰（クリック選択・ラベル・4段スケール・惑星公転）。
6. console は favicon 404 のみ（新規エラーが無いこと）。

見た目が弱ければ `PULSE_SPEED_FRACTION`（lightPulse.ts）・球の `opacity`/`color`（LightPulseSphere.ts）・ボタン/カウンタの `bottom` 値を実機調整（テストに影響しない見た目パラメータ）。

- [ ] **Step 7: Commit**

```bash
git add src/app.ts
git -c commit.gpgsign=false commit -m "feat: 光速パルスを app に結線（発射ボタン/波紋/経過時間カウンタ/到達通知）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## 完了後

全5タスク完了後、最上位モデル（opus）で全ブランチ最終レビュー（`<BASE>..HEAD`、BASE = Task1 着手前の HEAD）→ 指摘対応 → `progress.md`／`SESSION_HANDOFF.md` 更新。

## Self-Review（記入済み）

- **Spec coverage:** 受入基準1–6を Task で網羅（1,3,5=Task5 E2E / 2=Task1 `formatPulseTime`+Task4+Task5 / 4=設計の肝=Task1 成長速度∝viewDist+`pulseLightTimeMin`、Task5 E2E で確認 / 6=Task5 Step6）。到達通知＝Task5 `pulseReadoutText`。波紋＝Task2。ボタン＝Task3。カウンタ＝Task4。純粋ロジック＝Task1。
- **Placeholder scan:** なし（全 step に実コード・実コマンド・期待値）。
- **Type consistency:** `pulseGrowthAuPerSec`/`pulseLightTimeMin`/`formatPulseTime`/`pulseReached`（Task1）と Task5 の呼び出し、`LightPulseSphere.update/setVisible/dispose`（Task2）と Task5、`nearestStarsPc` の返り `{index,distPc}`（既存）と Task5 の `.distPc`/`.index` 参照が一致。
