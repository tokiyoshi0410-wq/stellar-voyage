# 太陽系の詳細表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 太陽系ビューに、各惑星の公転速度（軌道上）・自転速度（惑星近く）・太陽の銀河公転ラベル＋進行方向矢印を常時表示し、惑星クリックで地球からの最接近距離と光速/新幹線の所要時間を追加表示する（太陽系 starIndex 0 限定）。

**Architecture:** 太陽系専用の実データ＋純関数を新モジュール `src/system/solarFacts.ts` に集約。`app.ts` の system-view ラベル分岐とクリック処理を `starIndex === 0` で拡張し、`PlanetPanel` に追加行、`SystemScene` に太陽矢印を足す。手続き生成系は現状維持。

**Tech Stack:** TypeScript (strict + noUncheckedIndexedAccess), Three.js, Vitest, Vite。

## Global Constraints

- ユーザー向け文言は**日本語**、平易な表現。ワールド単位 **AU**。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。テストは `tests/` 配下、`import ... from '../../src/...'`。
- コミット末尾に `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`。署名エラー時 `git -c commit.gpgsign=false commit`。`--no-verify` 禁止。
- ビルド系は監査 hook が発火。テスト済み・隔離済みなら末尾に `# CLAUDE_AUDIT_OK`。本計画は主に `npm test`/`npx tsc --noEmit` で完結（Task 4 のみ build 確認）。
- 全オーバーレイ `pointer-events:none`（既存 LabelLayer/PlanetPanel 踏襲）。

## 実装ポリシー: TDD 厳密ゾーン と 実機調整ゾーン（サブエージェント必読）

- **◆ TDD 厳密ゾーン（純粋ロジック）**: `solarFacts` の純関数（`earthClosestApproachAu`・`formatManKm`・`formatLightTravel`・`formatShinkansenTravel`・データ配列長・逆回転フラグ）、`describePlanet` の文言生成（facts 有無での行の有無・逆回転表記・地球特例）。失敗テスト→実装→通過で厳密に。
- **◆ 実機調整ゾーン（見た目・配置、テストで値を固定しない）**: ラベルの正確な配置角度（軌道上の公転ラベルのオフセット角）、矢印の向き・長さ・色、文字密度。データの事実値（公転速度など）は正しさとして扱うが、E2E で見え方（重なり等）を調整。**具体的な座標・角度・色をテストで assert しない。**

## File Structure

```
src/system/solarFacts.ts         # 新規（純粋）: PLANET_FACTS/SUN_FACTS + 最接近/光速/新幹線ヘルパ
src/ui/PlanetPanel.ts            # 改修: describePlanet(planet, facts?, closestAu?) 追加行 + show 署名 + showText
src/system/SystemScene.ts        # 改修: starIndex 0 で太陽の進行方向 ArrowHelper + dispose で Line も解放
src/app.ts                       # 改修: 太陽系のラベル(公転/自転/太陽)、太陽クリック文、惑星クリックに facts
tests/system/solarFacts.test.ts  # 新規
tests/ui/planetPanel.test.ts     # 新規（describePlanet 純関数テスト）
tests/system/systemScene.test.ts # 追記（太陽矢印の有無）
```

**タスク順（依存）:** 1 solarFacts（独立）→ 2 PlanetPanel（1 に依存）→ 3 SystemScene 矢印（独立）→ 4 app.ts 結線（1,2,3 に依存, 描画=コントローラ E2E）。

---

### Task 1: solarFacts（太陽系専用データ + 純関数）

**Files:**
- Create: `src/system/solarFacts.ts`
- Test: `tests/system/solarFacts.test.ts`

**Interfaces:**
- Consumes: `formatLightTime(lightMinutes: number): string`（`src/edu/scaleInfo.ts`、既存）
- Produces:
  - `interface PlanetFacts { orbitalSpeedKmS:number; orbitalPeriodYr:number; rotationSpeedKmH:number; retrograde:boolean }`
  - `const PLANET_FACTS: PlanetFacts[]`（8 要素, index 0=水星…7=海王星）
  - `interface SunFacts { galacticSpeedKmS:number; galacticPeriodYr:number; galacticCenterLy:number; rotationSpeedKmH:number }`, `const SUN_FACTS: SunFacts`
  - `earthClosestApproachAu(a:number):number`、`formatManKm(au:number):string`、`formatLightTravel(au:number):string`、`formatShinkansenTravel(au:number):string`

> **ゾーン区分:** すべて TDD 厳密（純粋・決定的）。事実値（公転速度等）はデータだが、テストは配列長・逆回転フラグ・ヘルパの計算結果（決定的）を検証。

- [ ] **Step 1: 失敗テストを書く** — `tests/system/solarFacts.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  PLANET_FACTS, SUN_FACTS, earthClosestApproachAu,
  formatManKm, formatLightTravel, formatShinkansenTravel,
} from '../../src/system/solarFacts';

describe('solarFacts', () => {
  it('has 8 planets index-aligned with getSolarSystem', () => {
    expect(PLANET_FACTS.length).toBe(8);
  });
  it('flags Venus(1) and Uranus(6) retrograde, Earth(2) not', () => {
    expect(PLANET_FACTS[1]!.retrograde).toBe(true);
    expect(PLANET_FACTS[6]!.retrograde).toBe(true);
    expect(PLANET_FACTS[2]!.retrograde).toBe(false);
  });
  it('earthClosestApproachAu = |a - 1|', () => {
    expect(earthClosestApproachAu(1.52)).toBeCloseTo(0.52, 5);
    expect(earthClosestApproachAu(1)).toBe(0);
    expect(earthClosestApproachAu(0.72)).toBeCloseTo(0.28, 5);
  });
  it('formatManKm rounds 万km and switches to 億km', () => {
    expect(formatManKm(0.52)).toBe('約7800万km');
    expect(formatManKm(4.2)).toMatch(/億km$/);
  });
  it('formatShinkansenTravel gives years for planet distances', () => {
    expect(formatShinkansenTravel(0.52)).toBe('約30年');
    expect(formatShinkansenTravel(29.1)).toMatch(/約1\d{3}年/);
  });
  it('formatLightTravel gives minutes for Mars, hours for Neptune', () => {
    expect(formatLightTravel(0.52)).toMatch(/分/);
    expect(formatLightTravel(29.1)).toMatch(/時間/);
  });
  it('SUN_FACTS carries galactic data', () => {
    expect(SUN_FACTS.galacticSpeedKmS).toBe(220);
    expect(SUN_FACTS.galacticCenterLy).toBe(26000);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/solarFacts.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装** — `src/system/solarFacts.ts`

```ts
import { formatLightTime } from '../edu/scaleInfo';

export interface PlanetFacts {
  orbitalSpeedKmS: number;
  orbitalPeriodYr: number;
  rotationSpeedKmH: number; // 赤道
  retrograde: boolean;
}

// getSolarSystem() と index 整合（0=水星 … 7=海王星）
export const PLANET_FACTS: PlanetFacts[] = [
  { orbitalSpeedKmS: 47.4, orbitalPeriodYr: 0.24, rotationSpeedKmH: 11,    retrograde: false }, // 水星
  { orbitalSpeedKmS: 35.0, orbitalPeriodYr: 0.62, rotationSpeedKmH: 6.5,   retrograde: true  }, // 金星
  { orbitalSpeedKmS: 29.8, orbitalPeriodYr: 1.00, rotationSpeedKmH: 1674,  retrograde: false }, // 地球
  { orbitalSpeedKmS: 24.1, orbitalPeriodYr: 1.88, rotationSpeedKmH: 866,   retrograde: false }, // 火星
  { orbitalSpeedKmS: 13.1, orbitalPeriodYr: 11.9, rotationSpeedKmH: 45000, retrograde: false }, // 木星
  { orbitalSpeedKmS: 9.7,  orbitalPeriodYr: 29.5, rotationSpeedKmH: 35500, retrograde: false }, // 土星
  { orbitalSpeedKmS: 6.8,  orbitalPeriodYr: 84,   rotationSpeedKmH: 9320,  retrograde: true  }, // 天王星
  { orbitalSpeedKmS: 5.4,  orbitalPeriodYr: 165,  rotationSpeedKmH: 9660,  retrograde: false }, // 海王星
];

export interface SunFacts {
  galacticSpeedKmS: number;
  galacticPeriodYr: number;
  galacticCenterLy: number;
  rotationSpeedKmH: number;
}
export const SUN_FACTS: SunFacts = {
  galacticSpeedKmS: 220,
  galacticPeriodYr: 2.3e8,
  galacticCenterLy: 26000,
  rotationSpeedKmH: 7200,
};

const AU_KM = 1.496e8;
const LIGHT_KM_S = 299792.458;
const SHINKANSEN_KMH = 300;

/** 地球からの最接近距離（円軌道近似, AU） */
export function earthClosestApproachAu(semiMajorAxisAu: number): number {
  return Math.abs(semiMajorAxisAu - 1);
}

/** AU を「約N万km」/「約N億km」(>=1億km) で。万km は 100万km 単位に丸め。 */
export function formatManKm(au: number): string {
  const km = au * AU_KM;
  const oku = km / 1e8;
  if (oku >= 1) return `約${Number(oku.toPrecision(2))}億km`;
  const man = km / 1e4;
  return `約${Math.round(man / 100) * 100}万km`;
}

/** 距離(AU)を光が進む時間（既存 formatLightTime へ委譲） */
export function formatLightTravel(au: number): string {
  const lightMinutes = (au * AU_KM) / LIGHT_KM_S / 60;
  return formatLightTime(lightMinutes);
}

/** 距離(AU)を新幹線(300km/h)で進む時間（主に年、<1年は日） */
export function formatShinkansenTravel(au: number): string {
  const hours = (au * AU_KM) / SHINKANSEN_KMH;
  const years = hours / (24 * 365);
  if (years >= 1) return `約${Math.round(years)}年`;
  return `約${Math.round(hours / 24)}日`;
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/system/solarFacts.test.ts` → PASS
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/system/solarFacts.ts tests/system/solarFacts.test.ts
git -c commit.gpgsign=false commit -m "feat: add solarFacts (planet/sun real data + distance/travel-time helpers)"
```

---

### Task 2: PlanetPanel の詳細行

**Files:**
- Modify: `src/ui/PlanetPanel.ts`（`describePlanet` 拡張、`show` 署名拡張、`showText` 追加）
- Test: `tests/ui/planetPanel.test.ts`（新規、`describePlanet` の純関数テスト）

**Interfaces:**
- Consumes: `PlanetFacts`, `formatManKm`, `formatLightTravel`, `formatShinkansenTravel`（Task 1）; `Planet`（`src/system/types.ts`）
- Produces: `describePlanet(p: Planet, facts?: PlanetFacts, closestAu?: number): string`; `PlanetPanel.show(planet: Planet, facts?: PlanetFacts, closestAu?: number): void`; `PlanetPanel.showText(text: string): void`

> **ゾーン区分:** `describePlanet` の行生成は TDD 厳密（facts 有無/逆回転/地球特例）。パネルの見た目・位置は既存のまま（変更なし）。

- [ ] **Step 1: 失敗テストを書く** — `tests/ui/planetPanel.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { describePlanet } from '../../src/ui/PlanetPanel';
import type { Planet } from '../../src/system/types';
import { PLANET_FACTS, earthClosestApproachAu } from '../../src/system/solarFacts';

const mars: Planet = {
  name: '火星', type: 'rock', semiMajorAxisAu: 1.52, radiusEarth: 0.53, massEarth: 0.107,
  eqTempK: null, inHabitableZone: false, isReal: true, estimated: false,
};

describe('describePlanet', () => {
  it('omits facts lines when facts not given (procedural)', () => {
    const s = describePlanet(mars);
    expect(s).not.toMatch(/公転/);
    expect(s).toMatch(/種別/);
  });
  it('adds orbital/rotation/distance/travel lines with facts', () => {
    const s = describePlanet(mars, PLANET_FACTS[3], earthClosestApproachAu(1.52));
    expect(s).toMatch(/公転: 24.1 km\/s/);
    expect(s).toMatch(/自転: 赤道 866 km\/h/);
    expect(s).toMatch(/地球から最接近/);
    expect(s).toMatch(/新幹線/);
  });
  it('marks retrograde planets', () => {
    const venus: Planet = { ...mars, name: '金星', semiMajorAxisAu: 0.72 };
    const s = describePlanet(venus, PLANET_FACTS[1], earthClosestApproachAu(0.72));
    expect(s).toMatch(/自転: 赤道 6.5 km\/h\(逆回転\)/);
  });
  it('shows 母星 for Earth (closestAu 0), not distance/travel', () => {
    const earth: Planet = { ...mars, name: '地球', type: 'ocean', semiMajorAxisAu: 1.0 };
    const s = describePlanet(earth, PLANET_FACTS[2], 0);
    expect(s).toMatch(/母星/);
    expect(s).not.toMatch(/最接近/);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/ui/planetPanel.test.ts`
Expected: FAIL（`describePlanet` が facts/closestAu 引数を受けない・追加行なし）

- [ ] **Step 3: 実装** — `src/ui/PlanetPanel.ts` を差し替え

```ts
import type { Planet, PlanetType } from '../system/types';
import type { PlanetFacts } from '../system/solarFacts';
import { formatManKm, formatLightTravel, formatShinkansenTravel } from '../system/solarFacts';

const TYPE_LABEL: Record<PlanetType, string> = {
  rock: '岩石惑星', ocean: '海洋惑星', gas: 'ガス惑星', ice: '氷惑星',
};

export function describePlanet(p: Planet, facts?: PlanetFacts, closestAu?: number): string {
  const badge = p.isReal ? '実在' : '生成';
  const hz = p.inHabitableZone ? 'ハビタブルゾーン内' : 'ハビタブルゾーン外';
  const est = p.estimated ? '（推定値）' : '';
  const temp = p.eqTempK != null ? `平衡温度: ${Math.round(p.eqTempK)} K\n` : '';
  let s = `${p.name}（${badge}）\n` +
    `種別: ${TYPE_LABEL[p.type]}\n` +
    `軌道長半径: ${p.semiMajorAxisAu.toPrecision(3)} AU\n` +
    `半径: 地球の ${p.radiusEarth.toPrecision(3)} 倍${est}\n` +
    `質量: 地球の ${p.massEarth.toPrecision(3)} 倍${est}\n` +
    temp +
    `${hz}`;
  if (facts) {
    s += `\n公転: ${facts.orbitalSpeedKmS} km/s ・ 周期 ${facts.orbitalPeriodYr} 年` +
      `\n自転: 赤道 ${facts.rotationSpeedKmH} km/h${facts.retrograde ? '(逆回転)' : ''}`;
    if (closestAu != null && closestAu > 0) {
      s += `\n地球から最接近: ${formatManKm(closestAu)}（約${closestAu.toPrecision(2)} AU）` +
        `\n　光の速度で ${formatLightTravel(closestAu)}` +
        `\n　新幹線(300km/h)で ${formatShinkansenTravel(closestAu)}`;
    } else if (closestAu === 0) {
      s += `\n太陽からの距離: 1 AU（母星）`;
    }
  }
  return s;
}

export class PlanetPanel {
  private readonly el: HTMLDivElement;
  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;right:16px;top:16px;min-width:220px;color:#eaf2ff;' +
      'background:rgba(8,14,28,0.82);border:1px solid #2b4a7a;border-radius:8px;' +
      'padding:12px 16px;font:13px/1.6 system-ui,sans-serif;white-space:pre-line;display:none;';
    root.appendChild(this.el);
  }
  show(planet: Planet, facts?: PlanetFacts, closestAu?: number): void {
    this.el.textContent = describePlanet(planet, facts, closestAu); // textContent で XSS 回避
    this.el.style.display = 'block';
  }
  showText(text: string): void {
    this.el.textContent = text;
    this.el.style.display = 'block';
  }
  hide(): void { this.el.style.display = 'none'; }
}
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/ui/planetPanel.test.ts` → PASS
Run: `npx vitest run` → 全テスト PASS（既存 PlanetPanel 利用箇所が壊れないこと。app.ts は Task 4 で更新するのでこの時点では `show(planet)` の 1 引数呼びのまま＝オプショナル引数なので互換）
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/ui/PlanetPanel.ts tests/ui/planetPanel.test.ts
git -c commit.gpgsign=false commit -m "feat: add solar detail lines to PlanetPanel (orbital/rotation/distance/travel)"
```

---

### Task 3: SystemScene の太陽・進行方向矢印

**Files:**
- Modify: `src/system/SystemScene.ts`（starIndex 0 で `ArrowHelper` 追加、`dispose` で `Line` も解放）
- Test: `tests/system/systemScene.test.ts`（追記：矢印の有無）

**Interfaces:**
- Consumes: 既存 `SystemScene`（constructor(system: StellarSystem), `root: THREE.Group`, `dispose()`）
- Produces: なし（`root` に太陽系のとき `THREE.ArrowHelper` を1つ含む）

> **ゾーン区分:** 「太陽系だけ矢印が1つある / 手続き系には無い」の構造は TDD 厳密。矢印の向き・長さ・色は実機調整（テストで値を assert しない）。

- [ ] **Step 1: 失敗テストを追記** — `tests/system/systemScene.test.ts` に以下の describe を追加（先頭に `import * as THREE from 'three';` が無ければ追加）

```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { SystemScene } from '../../src/system/SystemScene';
import type { StellarSystem } from '../../src/system/types';

function makeSystem(starIndex: number): StellarSystem {
  return { starIndex, starName: 't', spectralClass: 'G', temperatureK: 5800, luminositySun: 1, planets: [] };
}

describe('SystemScene solar arrow', () => {
  it('adds a direction arrow for the Solar System (starIndex 0)', () => {
    const scene = new SystemScene(makeSystem(0));
    expect(scene.root.children.some((c) => c instanceof THREE.ArrowHelper)).toBe(true);
    scene.dispose();
  });
  it('does not add the arrow for procedural systems', () => {
    const scene = new SystemScene(makeSystem(5));
    expect(scene.root.children.some((c) => c instanceof THREE.ArrowHelper)).toBe(false);
    scene.dispose();
  });
});
```

（既存 systemScene.test.ts に別 describe があればその下に追記。`import` は重複させない。）

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run tests/system/systemScene.test.ts`
Expected: FAIL（矢印が追加されていない）

- [ ] **Step 3: 実装** — `src/system/SystemScene.ts`

constructor 内、`this.root.add(new THREE.PointLight(...))` の直前（または star 追加の直後）に追加:

```ts
    if (system.starIndex === 0) {
      // 太陽の銀河内での進行方向（模式的）。向き・長さ・色は見栄え調整可。
      const dir = new THREE.Vector3(1, 0, 0.3).normalize();
      const arrow = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0, 0), 1.2, 0xffd479, 0.25, 0.15);
      this.root.add(arrow);
    }
```

`dispose` を、`Line`（ArrowHelper の線）も解放するよう変更:

```ts
  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
```

- [ ] **Step 4: 通過を確認**

Run: `npx vitest run tests/system/systemScene.test.ts` → PASS
Run: `npx vitest run` → 全テスト PASS（既存 SystemScene テスト不変）
Run: `npx tsc --noEmit` → エラーなし

- [ ] **Step 5: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/system/SystemScene.ts tests/system/systemScene.test.ts
git -c commit.gpgsign=false commit -m "feat: add Sun galactic-motion arrow to SystemScene (solar only)"
```

---

### Task 4: app.ts 結線（太陽系ラベル・クリック詳細）— 描画タスク

**Files:**
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `PLANET_FACTS`, `SUN_FACTS`, `earthClosestApproachAu`（Task 1）; `PlanetPanel.show(planet, facts?, closestAu?)` / `showText`（Task 2）; `describePlanet`（Task 2, 間接）; 既存 `orbitPosition`/`planetPhase`/`formatAuDistance`/`pickPlanet`/`pickStar`/`describeStar`/`starDisplayName`
- Produces: なし（結線）。**単体テストなし** — 描画タスクのためコントローラが Playwright E2E で検証（Step 6）。

> **ゾーン区分:** 分岐の正しさ（太陽系のみ適用・クリック文言・地球特例）は E2E で検証。ラベル配置角（公転ラベルの `+Math.PI/2` オフセット）・矢印の見た目は実機調整。

- [ ] **Step 1: import 追加** — `src/app.ts` の import 群に

```ts
import { PLANET_FACTS, SUN_FACTS, earthClosestApproachAu } from './system/solarFacts';
```

- [ ] **Step 2: 惑星クリックに facts を渡す**

pointerup ハンドラ内、惑星ピックの分岐:
```ts
      const pIdx = pickPlanet([camAu.x, camAu.y, camAu.z], rayDir, currentSystem, PLANET_PICK_ANGLE);
      if (pIdx != null) {
        planetPanel.show(currentSystem.planets[pIdx]!);
        infoPanel.hide();
        return;
      }
```
を次に置換:
```ts
      const pIdx = pickPlanet([camAu.x, camAu.y, camAu.z], rayDir, currentSystem, PLANET_PICK_ANGLE);
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
```

- [ ] **Step 3: 太陽クリックで銀河公転パネル**

pointerup ハンドラ内、星ピックの分岐:
```ts
    const sIdx = pickStar(camPc, rayDir, catalog.columns, PICK_ANGLE);
    if (sIdx != null) {
      infoPanel.show(describeStar(catalog.columns, sIdx, starDisplayName(sIdx, catalog.nameOf(sIdx))));
      planetPanel.hide();
    } else {
      infoPanel.hide();
      planetPanel.hide();
    }
```
を次に置換:
```ts
    const sIdx = pickStar(camPc, rayDir, catalog.columns, PICK_ANGLE);
    if (sIdx != null) {
      if (currentSystem.starIndex === 0 && sIdx === 0) {
        planetPanel.showText(
          `太陽\n銀河公転: ${SUN_FACTS.galacticSpeedKmS} km/s（銀河を約${(SUN_FACTS.galacticPeriodYr / 1e8).toPrecision(2)}億年で1周）\n` +
          `銀河中心まで: 約${SUN_FACTS.galacticCenterLy / 1e4}万光年\n` +
          `自転: 赤道 約${SUN_FACTS.rotationSpeedKmH} km/h`,
        );
        infoPanel.hide();
      } else {
        infoPanel.show(describeStar(catalog.columns, sIdx, starDisplayName(sIdx, catalog.nameOf(sIdx))));
        planetPanel.hide();
      }
    } else {
      infoPanel.hide();
      planetPanel.hide();
    }
```

- [ ] **Step 4: 太陽系のラベル（公転/自転/太陽）**

frame ループのラベル構築 `if (fade > 0.5) { ... }` ブロックの中身を次に置換（`else if (scaleInfo.stage !== 'galaxy' && ...)` 以降は変更しない）:
```ts
    if (fade > 0.5) {
      const isSolar = currentSystem.starIndex === 0;
      if (isSolar) {
        labelItems.push({
          text: `太陽 ・ 公転 ${SUN_FACTS.galacticSpeedKmS}km/s（銀河を約${(SUN_FACTS.galacticPeriodYr / 1e8).toPrecision(2)}億年で1周）・ 自転 赤道約${SUN_FACTS.rotationSpeedKmH}km/h`,
          worldPos: [0, 0, 0],
        });
      } else {
        labelItems.push({ text: starDisplayName(currentSystem.starIndex, currentSystem.starName), worldPos: [0, 0, 0] });
      }
      currentSystem.planets.forEach((p, i) => {
        const phase = planetPhase(currentSystem.starIndex, i);
        const [px, py, pz] = orbitPosition(p.semiMajorAxisAu, phase);
        if (isSolar) {
          const f = PLANET_FACTS[i]!;
          labelItems.push({
            text: `${p.name}  ${formatAuDistance(p.semiMajorAxisAu)} ・ 自転 ${f.rotationSpeedKmH}km/h${f.retrograde ? '(逆)' : ''}`,
            worldPos: [px, py, pz],
          });
          const [ox, oy, oz] = orbitPosition(p.semiMajorAxisAu, phase + Math.PI / 2);
          labelItems.push({ text: `公転 ${f.orbitalSpeedKmS}km/s`, worldPos: [ox, oy, oz] });
        } else {
          labelItems.push({ text: `${p.name}  ${formatAuDistance(p.semiMajorAxisAu)}`, worldPos: [px, py, pz] });
        }
      });
    } else if (scaleInfo.stage !== 'galaxy' && scaleInfo.stage !== 'localgroup') {
```

（`else if` の行はマーカーで、既存の続きに繋げる。既存 `if (fade > 0.5)` の中身のみ置換すること。）

- [ ] **Step 5: 型・ビルド・全テスト**

Run: `npx tsc --noEmit` → エラーなし
Run: `npx vitest run` → 全テスト PASS
Run: `npm run build # CLAUDE_AUDIT_OK` → 成功

- [ ] **Step 6: コミット**（末尾に Co-Authored-By trailer）

```bash
git add src/app.ts
git -c commit.gpgsign=false commit -m "feat: wire solar-system detail labels + click panels (orbital/rotation/travel/sun)"
```

- [ ] **Step 7: コントローラが Playwright E2E で受入基準を検証**

`npm run dev`（→ `http://localhost:5181`）で:
1. 太陽系ビューで各惑星の軌道上に「公転 ○km/s」、惑星near に「(名前) … 自転 ○km/h」（金星・天王星は「(逆)」）が出る。
2. 太陽near に「太陽 ・ 公転 220km/s（銀河を約2.3億年で1周）・ 自転 赤道約7200km/h」＋太陽から伸びる矢印。
3. 火星クリック → パネルに公転24.1km/s・周期1.88年 / 自転 赤道866km/h / 地球から最接近 約7800万km / 光の速度で … / 新幹線で 約30年。地球クリック → 「太陽からの距離 1 AU（母星）」。
4. 太陽クリック → 銀河公転パネル（220km/s・約2.3億年・銀河中心まで約2.6万光年・自転）。
5. 別の星（手続き系）に突入すると追加表示は出ず現状のまま。クリック・既存パネル非干渉。

**描画タスクのため、Step 7 の E2E が通るまで Task 4 は未完。** 配置の重なり等は live-tune で調整。

---

## Self-Review（記入済み — spec との照合）

**Spec coverage:**
- solarFacts データ＋純関数（最接近/光速/新幹線）→ Task 1 ✅
- クリックパネル追加行（公転/自転/距離/所要時間・地球特例）→ Task 2 ✅
- 太陽の進行方向矢印 → Task 3 ✅
- 常時ラベル（公転 on 軌道・自転 near 惑星・太陽ラベル）+ 太陽クリック銀河パネル + 惑星クリック facts + 手続き系非適用 → Task 4 ✅
- 受入基準 1〜5 → Task 4 Step 7 ✅

**Placeholder scan:** 各コード step に完全コードあり。曖昧語なし。

**Type consistency:** `PlanetFacts`/`PLANET_FACTS`/`SUN_FACTS`/`earthClosestApproachAu`/`formatManKm`/`formatLightTravel`/`formatShinkansenTravel` は Task 1 定義 → Task 2/4 消費で一致。`describePlanet(p, facts?, closestAu?)` と `PlanetPanel.show(planet, facts?, closestAu?)`/`showText` は Task 2 定義 → Task 4 消費で一致。`system.starIndex === 0` で太陽系判定を全タスクで統一。

**未解決の実装時判断（実装者が現物で確定）:** app.ts の該当ブロックは localgroup 結線後の現行行に合わせて置換（`if (fade > 0.5)` 本体・pointerup の 2 分岐）。矢印の dispose は `Line` 追加で解放。

