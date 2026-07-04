# stellar-voyage M1（星空と飛行）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 実在の HYG 星カタログを 3D 星野として描画し、自由飛行・ワープで星に近づき、星を選択して詳細情報を見られる、単体で遊べる Web アプリを作る。

**Architecture:** Vite + TypeScript + Three.js の静的 SPA。ビルド時スクリプトで HYG CSV をバイナリ（Structure-of-Arrays）へ変換し、実行時に typed array へデコードして 1 ドロー call のポイントクラウドで描画する。世界座標はパーセク単位・カメラ相対で扱い、対数深度バッファで近接〜遠方を同時描画する。移動は throttle を対数マッピングして 0〜0.999c（通常航行）とワープ域（〜約 10¹¹ c）を連続制御する。

**Tech Stack:** TypeScript 5.9、Three.js（r160+）、Vite 7、vitest 3。追加ランタイム依存は Three.js のみ。

## Global Constraints

- パッケージマネージャは npm。`"type": "module"`。Node は `C:\Users\yusuke\bin\nodejs\` を使用。
- ランタイム依存は Three.js のみ追加する（YAGNI）。ビルド専用依存（tsx 等）は devDependencies。
- 全ユーザー向け文言は**日本語**。
- 座標系の距離単位は**パーセク（pc）**。表示は光年（ly）へ換算（`1 pc = 3.2615637769 ly`）。
- HYG Database は **CC BY-SA 4.0**。About/README にクレジット必須（後続 M4 で About 実装、README は本 M1 で記載）。
- 相対論の物理は M3 で実装。M1 の速度は「見かけの c 係数」表示に留める（正式なローレンツ計算は M3）。
- テストは vitest。純粋ロジック（変換・生成・整形）を単体テストし、描画は目視確認。
- コミットはタスク単位で頻繁に行う。コミットメッセージ末尾に
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` を付ける。
- 数値定数（TIME_COMPRESSION 等）は体感チューニング用でありテストは境界・単調性を検証する。

## File Structure

```
stellar-voyage/
  package.json            # scripts, deps
  tsconfig.json
  vite.config.ts
  index.html              # canvas + UI ルート
  README.md               # 概要・クレジット・起動方法
  data/                   # 開発者が置く生 CSV（git 管理外）
    .gitignore            # hygdata_v3.csv を無視
  public/data/            # 生成物（git 管理外）
    hyg.bin               # 生成: 数値列バイナリ
    hyg-names.json        # 生成: index→固有名（固有名を持つ星のみ）
  scripts/
    build-catalog.ts      # CSV → hyg.bin + hyg-names.json 変換
  src/
    astro/
      color.ts            # B-V → 温度 → RGB
      spectral.ts         # 温度 → スペクトル分類、諸元換算（距離・光度）
    catalog/
      format.ts           # バイナリのヘッダ定義・エンコード/デコード（共有）
      StarCatalog.ts      # 実行時ローダ（fetch → typed arrays）
    engine/
      Renderer.ts         # scene/camera/renderer/対数深度・リサイズ
      FloatingOrigin.ts   # float64 カメラ世界座標と float32 相対化
    starfield/
      StarField.ts        # ポイントクラウド geometry/material 構築
      starfield.vert.glsl
      starfield.frag.glsl
    flight/
      ShipController.ts   # throttle→速度、位置積分、ワープ状態
      InputController.ts  # キー/マウス → 操作意図
    selection/
      Picker.ts           # レイ最近傍の星を選択
    ui/
      format.ts           # HUD/パネル用の数値整形（純粋関数）
      HUD.ts              # 速度・目標の表示
      InfoPanel.ts        # 選択星の詳細
    app.ts                # 全結線・メインループ・WebGL2 検出
    main.ts               # エントリ
  tests/
    astro/color.test.ts
    astro/spectral.test.ts
    catalog/format.test.ts
    catalog/starCatalog.test.ts
    engine/floatingOrigin.test.ts
    starfield/starField.test.ts
    flight/shipController.test.ts
    flight/inputController.test.ts
    selection/picker.test.ts
    ui/format.test.ts
  scripts/__fixtures__/
    sample-hyg.csv        # テスト用の小さな CSV
```

---

### Task 1: プロジェクト scaffold（Vite + TS + Three.js + vitest）

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `.gitignore`, `README.md`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: なし
- Produces: `npm run dev`（Vite 起動）, `npm test`（vitest 実行）, `npm run build`, `npm run build:catalog`。

- [ ] **Step 1: 失敗するスモークテストを書く**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 2: 依存を入れて設定ファイルを作る**

`package.json`:
```json
{
  "name": "stellar-voyage",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "build:catalog": "tsx scripts/build-catalog.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "three": "^0.160.0"
  },
  "devDependencies": {
    "@types/three": "^0.160.0",
    "@types/node": "^25.9.2",
    "tsx": "^4.19.0",
    "typescript": "^5.9.0",
    "vite": "^7.1.0",
    "vitest": "^3.2.4"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "scripts", "tests"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5180 },
  build: { target: 'es2022' },
});
```

`index.html`:
```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Stellar Voyage — 宇宙探検シミュレータ</title>
    <style>
      html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
      #app { position: fixed; inset: 0; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`（この時点では最小）:
```ts
const app = document.getElementById('app');
if (app) app.textContent = 'Stellar Voyage — 起動準備中';
```

`.gitignore`:
```
node_modules
dist
data/hygdata_v3.csv
public/data/hyg.bin
public/data/hyg-names.json
```

- [ ] **Step 3: 依存インストール**

Run: `npm install`
Expected: `three` と dev 依存が入る。

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（1 passed）

- [ ] **Step 5: dev サーバ起動確認（目視）**

Run: `npm run dev`（起動後 Ctrl+C）
Expected: `http://localhost:5180` で「起動準備中」が黒背景に表示される。

- [ ] **Step 6: README を書く**

`README.md`:
```markdown
# Stellar Voyage

実在の星カタログと手続き生成で宇宙を旅する Web シミュレータ（M1: 星空と飛行）。

## 開発

    npm install
    # HYG カタログ CSV を data/ に置く（下記）
    npm run build:catalog   # public/data/hyg.bin を生成
    npm run dev

## データ

- 星カタログ: HYG Database v3（astronexus/HYG-Database）。`data/hygdata_v3.csv` に配置。
  ライセンス CC BY-SA 4.0。© astronexus, HYG Database contributors.

## テスト

    npm test
```

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "chore: scaffold Vite + TypeScript + Three.js + vitest"
```

---

### Task 2: バイナリフォーマット定義（エンコード/デコード共有）

**Files:**
- Create: `src/catalog/format.ts`
- Test: `tests/catalog/format.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `MAGIC = 0x53564859`（"SVHY" LE）, `VERSION = 1`
  - `interface StarColumns { count: number; x: Float32Array; y: Float32Array; z: Float32Array; mag: Float32Array; absmag: Float32Array; ci: Float32Array; }`
    （x,y,z はパーセク・銀河直交座標、mag は視等級、absmag は絶対等級、ci は B-V 色指数）
  - `function encodeCatalog(cols: StarColumns): ArrayBuffer`
  - `function decodeCatalog(buffer: ArrayBuffer): StarColumns`

- [ ] **Step 1: 失敗するテストを書く**

`tests/catalog/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { encodeCatalog, decodeCatalog, MAGIC, VERSION } from '../../src/catalog/format';

function sample() {
  return {
    count: 2,
    x: new Float32Array([1, -4]),
    y: new Float32Array([2, 5]),
    z: new Float32Array([3, -6]),
    mag: new Float32Array([-1.46, 0.5]),
    absmag: new Float32Array([1.42, 4.8]),
    ci: new Float32Array([0.0, 0.63]),
  };
}

describe('catalog format', () => {
  it('round-trips columns', () => {
    const buf = encodeCatalog(sample());
    const out = decodeCatalog(buf);
    expect(out.count).toBe(2);
    expect(Array.from(out.z)).toEqual([3, -6]);
    expect(out.ci[1]).toBeCloseTo(0.63, 5);
  });

  it('writes magic and version in header', () => {
    const buf = encodeCatalog(sample());
    const view = new DataView(buf);
    expect(view.getUint32(0, true)).toBe(MAGIC);
    expect(view.getUint32(4, true)).toBe(VERSION);
    expect(view.getUint32(8, true)).toBe(2);
  });

  it('rejects wrong magic', () => {
    const buf = new ArrayBuffer(12);
    expect(() => decodeCatalog(buf)).toThrow(/magic/i);
  });
}); 
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- format`
Expected: FAIL（`format` モジュール未実装）

- [ ] **Step 3: 実装**

`src/catalog/format.ts`:
```ts
export const MAGIC = 0x53564859; // 'SVHY' little-endian
export const VERSION = 1;

const COLUMNS = ['x', 'y', 'z', 'mag', 'absmag', 'ci'] as const;
const HEADER_BYTES = 12; // magic(4) + version(4) + count(4)

export interface StarColumns {
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  mag: Float32Array;
  absmag: Float32Array;
  ci: Float32Array;
}

export function encodeCatalog(cols: StarColumns): ArrayBuffer {
  const { count } = cols;
  const buffer = new ArrayBuffer(HEADER_BYTES + COLUMNS.length * count * 4);
  const view = new DataView(buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, VERSION, true);
  view.setUint32(8, count, true);
  let offset = HEADER_BYTES;
  for (const name of COLUMNS) {
    new Float32Array(buffer, offset, count).set(cols[name]);
    offset += count * 4;
  }
  return buffer;
}

export function decodeCatalog(buffer: ArrayBuffer): StarColumns {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MAGIC) throw new Error('bad magic in catalog');
  if (view.getUint32(4, true) !== VERSION) throw new Error('unsupported catalog version');
  const count = view.getUint32(8, true);
  const out: Record<string, unknown> = { count };
  let offset = HEADER_BYTES;
  for (const name of COLUMNS) {
    out[name] = new Float32Array(buffer.slice(offset, offset + count * 4));
    offset += count * 4;
  }
  return out as unknown as StarColumns;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- format`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/catalog/format.ts tests/catalog/format.test.ts
git commit -m "feat: define binary star-catalog format with round-trip codec"
```

---

### Task 3: 天体換算（色・スペクトル・距離・光度）

**Files:**
- Create: `src/astro/color.ts`, `src/astro/spectral.ts`
- Test: `tests/astro/color.test.ts`, `tests/astro/spectral.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - color.ts: `bvToTemperature(bv: number): number`（ケルビン, Ballesteros 2012）,
    `temperatureToRGB(kelvin: number): [number, number, number]`（各 0..1）,
    `bvToRGB(bv: number): [number, number, number]`
  - spectral.ts: `PARSEC_IN_LY = 3.2615637769`, `SUN_ABSMAG = 4.83`,
    `temperatureToSpectralClass(kelvin: number): 'O'|'B'|'A'|'F'|'G'|'K'|'M'`,
    `parsecsToLightYears(pc: number): number`,
    `absMagToLuminosity(absmag: number): number`（太陽光度比、bolometric 補正は無視の近似）

- [ ] **Step 1: 失敗するテストを書く**

`tests/astro/color.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { bvToTemperature, temperatureToRGB, bvToRGB } from '../../src/astro/color';

describe('color', () => {
  it('sun-like B-V ~0.63 gives ~5700-5900K', () => {
    const t = bvToTemperature(0.63);
    expect(t).toBeGreaterThan(5600);
    expect(t).toBeLessThan(6000);
  });

  it('blue star (negative B-V) is hotter than red star', () => {
    expect(bvToTemperature(-0.3)).toBeGreaterThan(bvToTemperature(1.5));
  });

  it('temperatureToRGB returns channels in 0..1', () => {
    const [r, g, b] = temperatureToRGB(6000);
    for (const c of [r, g, b]) { expect(c).toBeGreaterThanOrEqual(0); expect(c).toBeLessThanOrEqual(1); }
  });

  it('hot star is bluer than cool star', () => {
    const hot = bvToRGB(-0.3);
    const cool = bvToRGB(1.5);
    expect(hot[2]).toBeGreaterThan(cool[2]); // more blue
    expect(cool[0]).toBeGreaterThan(cool[2]); // red dominates cool star
  });
});
```

`tests/astro/spectral.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  temperatureToSpectralClass, parsecsToLightYears, absMagToLuminosity, PARSEC_IN_LY,
} from '../../src/astro/spectral';

describe('spectral', () => {
  it('classifies by temperature', () => {
    expect(temperatureToSpectralClass(40000)).toBe('O');
    expect(temperatureToSpectralClass(5800)).toBe('G');
    expect(temperatureToSpectralClass(3000)).toBe('M');
  });

  it('converts parsecs to light years', () => {
    expect(parsecsToLightYears(1)).toBeCloseTo(PARSEC_IN_LY, 6);
    expect(parsecsToLightYears(10)).toBeCloseTo(32.615637, 4);
  });

  it('sun (absmag 4.83) has luminosity ~1', () => {
    expect(absMagToLuminosity(4.83)).toBeCloseTo(1, 3);
  });

  it('brighter absolute magnitude means higher luminosity', () => {
    expect(absMagToLuminosity(0)).toBeGreaterThan(absMagToLuminosity(5));
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- astro`
Expected: FAIL（モジュール未実装）

- [ ] **Step 3: 実装**

`src/astro/color.ts`:
```ts
// Ballesteros (2012) の B-V → 実効温度近似
export function bvToTemperature(bv: number): number {
  const t = 0.92 * bv;
  return 4600 * (1 / (t + 1.7) + 1 / (t + 0.62));
}

// Tanner Helland の黒体色近似（0..1 正規化）
export function temperatureToRGB(kelvin: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const clamp = (x: number) => Math.max(0, Math.min(255, x)) / 255;
  return [clamp(r), clamp(g), clamp(b)];
}

export function bvToRGB(bv: number): [number, number, number] {
  return temperatureToRGB(bvToTemperature(bv));
}
```

`src/astro/spectral.ts`:
```ts
export const PARSEC_IN_LY = 3.2615637769;
export const SUN_ABSMAG = 4.83;

export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

const CLASS_FLOORS: [number, SpectralClass][] = [
  [30000, 'O'], [10000, 'B'], [7500, 'A'], [6000, 'F'],
  [5200, 'G'], [3700, 'K'], [0, 'M'],
];

export function temperatureToSpectralClass(kelvin: number): SpectralClass {
  for (const [floor, cls] of CLASS_FLOORS) if (kelvin >= floor) return cls;
  return 'M';
}

export function parsecsToLightYears(pc: number): number {
  return pc * PARSEC_IN_LY;
}

// bolometric 補正を無視した近似（視覚等級ベース）
export function absMagToLuminosity(absmag: number): number {
  return Math.pow(10, (SUN_ABSMAG - absmag) / 2.5);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- astro`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/astro tests/astro
git commit -m "feat: add astro conversions (B-V color, spectral class, distance, luminosity)"
```

---

### Task 4: カタログ変換スクリプト（CSV → hyg.bin + names.json）

**Files:**
- Create: `scripts/build-catalog.ts`, `scripts/__fixtures__/sample-hyg.csv`
- Test: `tests/catalog/buildCatalog.test.ts`
- Create: `data/.gitignore`

**Interfaces:**
- Consumes: `encodeCatalog`（Task 2）
- Produces:
  - `parseHygCsv(text: string): { columns: StarColumns; names: Record<number, string> }`
    （エクスポートして単体テスト可能にする。行フィルタ: `x/y/z` が数値かつ視等級 `mag <= 7.5`）
  - CLI 実行時: `data/hygdata_v3.csv` を読み `public/data/hyg.bin` と `public/data/hyg-names.json` を書く

HYG v3 CSV の使用カラム: `x,y,z`（パーセク・直交座標）, `mag`（視等級）, `absmag`（絶対等級）,
`ci`（B-V 色指数）, `proper`（固有名, 空可）。names.json は `proper` が非空の行のみ、
**フィルタ後の出力インデックス**をキーにする。

- [ ] **Step 1: フィクスチャ CSV を作る**

`scripts/__fixtures__/sample-hyg.csv`（ヘッダ + 3 行。1 行は mag>7.5 で除外される想定）:
```csv
id,proper,mag,absmag,ci,x,y,z
1,Sol,-26.7,4.85,0.656,0.0,0.0,0.0
2,Sirius,-1.44,1.45,0.0,-1.1,-1.9,1.2
3,,8.2,12.3,1.5,3.0,4.0,5.0
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/catalog/buildCatalog.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseHygCsv } from '../../scripts/build-catalog';

const csv = readFileSync(
  fileURLToPath(new URL('../../scripts/__fixtures__/sample-hyg.csv', import.meta.url)),
  'utf8',
);

describe('parseHygCsv', () => {
  it('keeps only stars with mag <= 7.5', () => {
    const { columns } = parseHygCsv(csv);
    expect(columns.count).toBe(2); // id 3 (mag 8.2) is dropped
  });

  it('maps columns correctly', () => {
    const { columns } = parseHygCsv(csv);
    expect(columns.mag[0]).toBeCloseTo(-26.7, 3);
    expect(columns.x[1]).toBeCloseTo(-1.1, 3);
    expect(columns.ci[0]).toBeCloseTo(0.656, 3);
  });

  it('collects proper names keyed by output index', () => {
    const { names } = parseHygCsv(csv);
    expect(names[0]).toBe('Sol');
    expect(names[1]).toBe('Sirius');
    expect(names[2]).toBeUndefined();
  });
});
```

- [ ] **Step 3: 失敗を確認**

Run: `npm test -- buildCatalog`
Expected: FAIL（`parseHygCsv` 未実装）

- [ ] **Step 4: 実装**

`scripts/build-catalog.ts`:
```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { encodeCatalog, type StarColumns } from '../src/catalog/format';

const MAG_LIMIT = 7.5;

export function parseHygCsv(text: string): { columns: StarColumns; names: Record<number, string> } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0]!.split(',');
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`missing column: ${name}`);
    return i;
  };
  const iMag = col('mag'), iAbs = col('absmag'), iCi = col('ci');
  const iX = col('x'), iY = col('y'), iZ = col('z'), iProper = col('proper');

  const x: number[] = [], y: number[] = [], z: number[] = [];
  const mag: number[] = [], absmag: number[] = [], ci: number[] = [];
  const names: Record<number, string> = {};

  for (let r = 1; r < lines.length; r++) {
    const f = lines[r]!.split(',');
    const px = Number(f[iX]), py = Number(f[iY]), pz = Number(f[iZ]);
    const m = Number(f[iMag]);
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) continue;
    if (!Number.isFinite(m) || m > MAG_LIMIT) continue;
    const idx = x.length;
    x.push(px); y.push(py); z.push(pz);
    mag.push(m);
    absmag.push(Number(f[iAbs]) || 0);
    ci.push(Number(f[iCi]) || 0);
    const proper = (f[iProper] ?? '').trim();
    if (proper) names[idx] = proper;
  }

  const columns: StarColumns = {
    count: x.length,
    x: Float32Array.from(x), y: Float32Array.from(y), z: Float32Array.from(z),
    mag: Float32Array.from(mag), absmag: Float32Array.from(absmag), ci: Float32Array.from(ci),
  };
  return { columns, names };
}

function main() {
  const csv = readFileSync('data/hygdata_v3.csv', 'utf8');
  const { columns, names } = parseHygCsv(csv);
  mkdirSync('public/data', { recursive: true });
  const buffer = encodeCatalog(columns);
  writeFileSync('public/data/hyg.bin', Buffer.from(buffer));
  writeFileSync('public/data/hyg-names.json', JSON.stringify(names));
  console.log(`wrote ${columns.count} stars, ${Object.keys(names).length} named`);
}

// CLI 実行時のみ main を呼ぶ（テスト import 時は呼ばない）
if (process.argv[1] && process.argv[1].endsWith('build-catalog.ts')) main();
```

`data/.gitignore`:
```
hygdata_v3.csv
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- buildCatalog`
Expected: PASS

- [ ] **Step 6: 実データで生成確認（目視・任意）**

HYG CSV を取得して配置（開発者手順）:
```bash
curl -L -o data/hygdata_v3.csv \
  https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/v3/hyg_v37.csv
npm run build:catalog
```
Expected: `wrote NNNNN stars, NNN named`、`public/data/hyg.bin` が生成される。
（注: 列名が異なる版では header と `col()` を合わせる。`mag/absmag/ci/x/y/z/proper` が必須。）

- [ ] **Step 7: コミット**

```bash
git add scripts data/.gitignore tests/catalog/buildCatalog.test.ts
git commit -m "feat: add HYG CSV to binary catalog build script"
```

---

### Task 5: FloatingOrigin（float64 カメラ座標 → float32 相対化）

**Files:**
- Create: `src/engine/FloatingOrigin.ts`
- Test: `tests/engine/floatingOrigin.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `class FloatingOrigin { position: [number, number, number] (float64);
    translate(dx, dy, dz): void; setPosition(x, y, z): void;
    relative(worldX, worldY, worldZ): [number, number, number] }`
  - `relative()` は世界座標からカメラ座標を引いた相対座標を返す（GPU 用 float32 前提）。

M1 のカタログ範囲（太陽から数千 pc 以内）ではカメラも同域に留まるため単精度相対で十分。
本クラスはカメラ世界位置を倍精度で保持し、将来（M2 のワープ長距離）の基盤とする。

- [ ] **Step 1: 失敗するテストを書く**

`tests/engine/floatingOrigin.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { FloatingOrigin } from '../../src/engine/FloatingOrigin';

describe('FloatingOrigin', () => {
  it('accumulates translation in double precision', () => {
    const o = new FloatingOrigin();
    o.translate(1000, 0, 0);
    o.translate(0.0001, 0, 0);
    expect(o.position[0]).toBeCloseTo(1000.0001, 6);
  });

  it('relative() subtracts camera position', () => {
    const o = new FloatingOrigin();
    o.setPosition(500, -200, 30);
    expect(o.relative(510, -180, 30)).toEqual([10, 20, 0]);
  });

  it('keeps sub-parsec precision near a distant star', () => {
    const o = new FloatingOrigin();
    o.setPosition(3000, 0, 0);
    const rel = o.relative(3000.5, 0, 0);
    expect(rel[0]).toBeCloseTo(0.5, 6);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- floatingOrigin`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/engine/FloatingOrigin.ts`:
```ts
export class FloatingOrigin {
  // JS number は float64。世界座標を倍精度で保持する。
  position: [number, number, number] = [0, 0, 0];

  setPosition(x: number, y: number, z: number): void {
    this.position[0] = x;
    this.position[1] = y;
    this.position[2] = z;
  }

  translate(dx: number, dy: number, dz: number): void {
    this.position[0] += dx;
    this.position[1] += dy;
    this.position[2] += dz;
  }

  relative(worldX: number, worldY: number, worldZ: number): [number, number, number] {
    return [
      worldX - this.position[0],
      worldY - this.position[1],
      worldZ - this.position[2],
    ];
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- floatingOrigin`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/engine/FloatingOrigin.ts tests/engine/floatingOrigin.test.ts
git commit -m "feat: add floating-origin double-precision camera position"
```

---

### Task 6: Renderer（scene / camera / 対数深度 / リサイズ）

**Files:**
- Create: `src/engine/Renderer.ts`
- Test: `tests/engine/renderer.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `class Renderer { scene: THREE.Scene; camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer; constructor(canvasParent: HTMLElement);
    resize(width: number, height: number): void; render(): void; dispose(): void }`
  - カメラ: `fov 60, near 1e-5, far 1e12`、`logarithmicDepthBuffer: true`。
  - `isWebGL2Available(): boolean`（WebGL2 検出、app.ts が使用）

描画そのものは目視確認。テストは WebGL を必要としない純粋部分（`isWebGL2Available` の分岐、
`resize` のアスペクト更新）を jsdom + モックで検証する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/engine/renderer.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';

describe('isWebGL2Available', () => {
  it('returns false when getContext yields null', async () => {
    const { isWebGL2Available } = await import('../../src/engine/Renderer');
    const canvas = { getContext: vi.fn().mockReturnValue(null) } as unknown as HTMLCanvasElement;
    expect(isWebGL2Available(canvas)).toBe(false);
  });

  it('returns true when webgl2 context exists', async () => {
    const { isWebGL2Available } = await import('../../src/engine/Renderer');
    const canvas = { getContext: vi.fn().mockReturnValue({}) } as unknown as HTMLCanvasElement;
    expect(isWebGL2Available(canvas)).toBe(true);
  });
});
```

Note: vitest 設定に jsdom 環境が必要。`vite.config.ts` に test 設定を追加する（Step 3 で）。

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- renderer`
Expected: FAIL

- [ ] **Step 3: 実装**

`vite.config.ts` にテスト環境を追加（既存 defineConfig を置換）:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5180 },
  build: { target: 'es2022' },
  test: { environment: 'jsdom' },
});
```

`package.json` の devDependencies に追加: `"jsdom": "^26.1.0"` を入れて `npm install`。

`src/engine/Renderer.ts`:
```ts
import * as THREE from 'three';

export function isWebGL2Available(canvas: HTMLCanvasElement): boolean {
  try {
    return canvas.getContext('webgl2') != null;
  } catch {
    return false;
  }
}

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  constructor(canvasParent: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(60, 1, 1e-5, 1e12);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasParent.appendChild(this.renderer.domElement);
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- renderer`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/engine/Renderer.ts vite.config.ts package.json package-lock.json tests/engine/renderer.test.ts
git commit -m "feat: add Three.js renderer with logarithmic depth and WebGL2 detection"
```

---

### Task 7: StarCatalog ローダ + 星野ジオメトリ構築

**Files:**
- Create: `src/catalog/StarCatalog.ts`, `src/starfield/StarField.ts`,
  `src/starfield/starfield.vert.glsl`, `src/starfield/starfield.frag.glsl`
- Test: `tests/catalog/starCatalog.test.ts`, `tests/starfield/starField.test.ts`

**Interfaces:**
- Consumes: `decodeCatalog`（Task 2）, `bvToRGB`（Task 3）, `FloatingOrigin`（Task 5）
- Produces:
  - StarCatalog: `class StarCatalog { columns: StarColumns; names: Record<number,string>;
    static async load(binUrl: string, namesUrl: string): Promise<StarCatalog>;
    static fromData(columns, names): StarCatalog; nameOf(index: number): string | null }`
  - StarField: `buildStarGeometry(columns: StarColumns): { positions: Float32Array; colors: Float32Array; sizes: Float32Array }`
    （positions は絶対座標、colors は ci→RGB、sizes は視等級→点サイズ係数）,
    `class StarField { object: THREE.Points; constructor(columns: StarColumns);
    updateOrigin(origin: FloatingOrigin): void }`
  - サイズ式: `size = clamp(6.0 - mag, 0.5, 12.0)`（明るい星ほど大）。相対化はシェーダの
    uniform `uCameraPos` で行う（`position - uCameraPos`）。

- [ ] **Step 1: 失敗するテストを書く**

`tests/catalog/starCatalog.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { StarCatalog } from '../../src/catalog/StarCatalog';

const columns = {
  count: 2,
  x: new Float32Array([0, 1]), y: new Float32Array([0, 2]), z: new Float32Array([0, 3]),
  mag: new Float32Array([-1.4, 0.5]), absmag: new Float32Array([1.4, 4.8]),
  ci: new Float32Array([0.0, 0.63]),
};

describe('StarCatalog', () => {
  it('exposes name lookup', () => {
    const cat = StarCatalog.fromData(columns, { 1: 'Sirius' });
    expect(cat.nameOf(1)).toBe('Sirius');
    expect(cat.nameOf(0)).toBeNull();
  });
});
```

`tests/starfield/starField.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildStarGeometry } from '../../src/starfield/StarField';

const columns = {
  count: 2,
  x: new Float32Array([0, 10]), y: new Float32Array([0, 0]), z: new Float32Array([0, 0]),
  mag: new Float32Array([-1.0, 6.0]), absmag: new Float32Array([1, 5]),
  ci: new Float32Array([-0.3, 1.5]),
};

describe('buildStarGeometry', () => {
  it('produces one entry per star', () => {
    const g = buildStarGeometry(columns);
    expect(g.positions.length).toBe(6); // 2 stars * 3
    expect(g.colors.length).toBe(6);
    expect(g.sizes.length).toBe(2);
  });

  it('bright star is larger than faint star', () => {
    const g = buildStarGeometry(columns);
    expect(g.sizes[0]).toBeGreaterThan(g.sizes[1]);
  });

  it('sizes are clamped into [0.5, 12]', () => {
    const g = buildStarGeometry(columns);
    for (const s of g.sizes) { expect(s).toBeGreaterThanOrEqual(0.5); expect(s).toBeLessThanOrEqual(12); }
  });

  it('hot blue star has more blue than red star', () => {
    const g = buildStarGeometry(columns);
    expect(g.colors[2]).toBeGreaterThan(g.colors[5]); // star0 blue > star1 blue
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- starCatalog starField`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/catalog/StarCatalog.ts`:
```ts
import { decodeCatalog, type StarColumns } from './format';

export class StarCatalog {
  constructor(
    readonly columns: StarColumns,
    readonly names: Record<number, string>,
  ) {}

  static fromData(columns: StarColumns, names: Record<number, string>): StarCatalog {
    return new StarCatalog(columns, names);
  }

  static async load(binUrl: string, namesUrl: string): Promise<StarCatalog> {
    const [binRes, namesRes] = await Promise.all([fetch(binUrl), fetch(namesUrl)]);
    if (!binRes.ok) throw new Error(`failed to load catalog: ${binRes.status}`);
    const buffer = await binRes.arrayBuffer();
    const columns = decodeCatalog(buffer);
    const names = namesRes.ok ? await namesRes.json() : {};
    return new StarCatalog(columns, names);
  }

  nameOf(index: number): string | null {
    return this.names[index] ?? null;
  }
}
```

`src/starfield/starfield.vert.glsl`:
```glsl
uniform vec3 uCameraPos;
uniform float uPixelScale;
attribute float size;
varying vec3 vColor;

void main() {
  vColor = color;
  vec3 rel = position - uCameraPos;
  vec4 mv = modelViewMatrix * vec4(rel, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uPixelScale / max(-mv.z, 0.001);
  gl_PointSize = clamp(gl_PointSize, 1.0, 24.0);
}
```

`src/starfield/starfield.frag.glsl`:
```glsl
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  float alpha = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor, alpha);
}
```

`src/starfield/StarField.ts`:
```ts
import * as THREE from 'three';
import type { StarColumns } from '../catalog/format';
import { bvToRGB } from '../astro/color';
import type { FloatingOrigin } from '../engine/FloatingOrigin';
import vert from './starfield.vert.glsl?raw';
import frag from './starfield.frag.glsl?raw';

export function buildStarGeometry(columns: StarColumns): {
  positions: Float32Array; colors: Float32Array; sizes: Float32Array;
} {
  const n = columns.count;
  const positions = new Float32Array(n * 3);
  const colors = new Float32Array(n * 3);
  const sizes = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    positions[i * 3] = columns.x[i]!;
    positions[i * 3 + 1] = columns.y[i]!;
    positions[i * 3 + 2] = columns.z[i]!;
    const [r, g, b] = bvToRGB(columns.ci[i]!);
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    sizes[i] = Math.max(0.5, Math.min(12.0, 6.0 - columns.mag[i]!));
  }
  return { positions, colors, sizes };
}

export class StarField {
  readonly object: THREE.Points;
  private readonly material: THREE.ShaderMaterial;

  constructor(columns: StarColumns) {
    const { positions, colors, sizes } = buildStarGeometry(columns);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uCameraPos: { value: new THREE.Vector3() },
        uPixelScale: { value: 300.0 },
      },
      vertexShader: vert,
      fragmentShader: frag,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.object = new THREE.Points(geometry, this.material);
    this.object.frustumCulled = false;
  }

  updateOrigin(origin: FloatingOrigin): void {
    (this.material.uniforms.uCameraPos!.value as THREE.Vector3).set(
      origin.position[0], origin.position[1], origin.position[2],
    );
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- starCatalog starField`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/catalog/StarCatalog.ts src/starfield tests/catalog/starCatalog.test.ts tests/starfield/starField.test.ts
git commit -m "feat: add star catalog loader and point-cloud star field"
```

---

### Task 8: ShipController（throttle→速度、位置積分、ワープ状態）

**Files:**
- Create: `src/flight/ShipController.ts`
- Test: `tests/flight/shipController.test.ts`

**Interfaces:**
- Consumes: `FloatingOrigin`（Task 5）
- Produces:
  - `class ShipController { throttle: number (0..1); orientation: THREE.Quaternion;
    constructor(origin: FloatingOrigin);
    throttleToSpeedC(throttle: number): number;
    get speedC(): number; get isWarp(): boolean;
    update(dtSeconds: number): void }`
  - 定数: `C_PC_PER_S = 9.7156e-9`, `TIME_COMPRESSION = 3.156e7`,
    `NORMAL_BAND = 0.7`, `MAX_WARP_C = 3.156e10`
  - `throttleToSpeedC`: `throttle<=0.7` → `(throttle/0.7)*0.999`（0〜0.999c）、
    それ以上 → `pow(MAX_WARP_C, (throttle-0.7)/0.3)`（1〜MAX_WARP_C）
  - `update` は orientation の前方向へ `speedC * C_PC_PER_S * TIME_COMPRESSION * dt` pc 進め、
    `origin.translate` を呼ぶ。

- [ ] **Step 1: 失敗するテストを書く**

`tests/flight/shipController.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ShipController, NORMAL_BAND, MAX_WARP_C } from '../../src/flight/ShipController';
import { FloatingOrigin } from '../../src/engine/FloatingOrigin';

describe('ShipController.throttleToSpeedC', () => {
  const ship = new ShipController(new FloatingOrigin());

  it('is zero at zero throttle', () => {
    expect(ship.throttleToSpeedC(0)).toBe(0);
  });

  it('reaches ~0.999c at end of normal band', () => {
    expect(ship.throttleToSpeedC(NORMAL_BAND)).toBeCloseTo(0.999, 3);
  });

  it('is monotonically increasing', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const s = ship.throttleToSpeedC(Math.min(t, 1));
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });

  it('reaches MAX_WARP_C at full throttle', () => {
    expect(ship.throttleToSpeedC(1)).toBeCloseTo(MAX_WARP_C, 0);
  });
});

describe('ShipController.update', () => {
  it('moves the origin forward along -Z by default orientation', () => {
    const origin = new FloatingOrigin();
    const ship = new ShipController(origin);
    ship.throttle = NORMAL_BAND; // ~0.999c
    ship.update(1);
    // 前方 -Z に進む。距離 = 0.999 * C_PC_PER_S * TIME_COMPRESSION pc（約 0.306 pc）
    expect(origin.position[2]).toBeLessThan(0);
    expect(Math.abs(origin.position[2])).toBeGreaterThan(0.2);
  });

  it('does not move at zero throttle', () => {
    const origin = new FloatingOrigin();
    const ship = new ShipController(origin);
    ship.update(1);
    expect(origin.position).toEqual([0, 0, 0]);
  });

  it('flags warp above the normal band', () => {
    const ship = new ShipController(new FloatingOrigin());
    ship.throttle = 0.9;
    expect(ship.isWarp).toBe(true);
    ship.throttle = 0.5;
    expect(ship.isWarp).toBe(false);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- shipController`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/flight/ShipController.ts`:
```ts
import * as THREE from 'three';
import type { FloatingOrigin } from '../engine/FloatingOrigin';

export const C_PC_PER_S = 9.7156e-9;   // 光速 [pc/s]（実時間）
export const TIME_COMPRESSION = 3.156e7; // 実 1 秒 ≒ 1 年ぶんの移動
export const NORMAL_BAND = 0.7;         // 通常航行に割り当てる throttle 割合
export const MAX_WARP_C = 3.156e10;     // ワープ上限（約 1000 ly/s）

export class ShipController {
  throttle = 0;
  readonly orientation = new THREE.Quaternion();
  private readonly forward = new THREE.Vector3();

  constructor(private readonly origin: FloatingOrigin) {}

  throttleToSpeedC(throttle: number): number {
    const t = Math.max(0, Math.min(1, throttle));
    if (t <= NORMAL_BAND) return (t / NORMAL_BAND) * 0.999;
    const w = (t - NORMAL_BAND) / (1 - NORMAL_BAND);
    return Math.pow(MAX_WARP_C, w);
  }

  get speedC(): number {
    return this.throttleToSpeedC(this.throttle);
  }

  get isWarp(): boolean {
    return this.throttle > NORMAL_BAND;
  }

  update(dtSeconds: number): void {
    const speedC = this.speedC;
    if (speedC <= 0) return;
    const pc = speedC * C_PC_PER_S * TIME_COMPRESSION * dtSeconds;
    this.forward.set(0, 0, -1).applyQuaternion(this.orientation);
    this.origin.translate(this.forward.x * pc, this.forward.y * pc, this.forward.z * pc);
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- shipController`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/flight/ShipController.ts tests/flight/shipController.test.ts
git commit -m "feat: add ship controller with logarithmic throttle and warp band"
```

---

### Task 9: InputController（キー/マウス → 操作意図）

**Files:**
- Create: `src/flight/InputController.ts`
- Test: `tests/flight/inputController.test.ts`

**Interfaces:**
- Consumes: なし
- Produces:
  - `class InputController { constructor(target: HTMLElement);
    applyThrottle(current: number, dtSeconds: number): number;
    consumePointerDelta(): { dx: number; dy: number };
    dispose(): void }`
  - キー状態は内部保持。`applyThrottle` は W 押下で +、S 押下で −（`THROTTLE_RATE=0.4/s`）、
    0..1 にクランプして返す。
  - ポインタ移動は蓄積し `consumePointerDelta` で取り出してリセット（呼出側が視点回転に使う）。
  - 定数 `THROTTLE_RATE = 0.4` をエクスポート。

`applyThrottle` を純粋関数的に（現在値 + dt から新値を返す）することで、キー入力をモックした
単体テストを可能にする。

- [ ] **Step 1: 失敗するテストを書く**

`tests/flight/inputController.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { InputController, THROTTLE_RATE } from '../../src/flight/InputController';

function makeTarget() {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  return {
    el: {
      addEventListener: (t: string, cb: any) => { (listeners[t] ??= []).push(cb); },
      removeEventListener: () => {},
    } as unknown as HTMLElement,
    fire: (t: string, e: any) => { (listeners[t] ?? []).forEach((cb) => cb(e)); },
  };
}

describe('InputController.applyThrottle', () => {
  let target: ReturnType<typeof makeTarget>;
  let input: InputController;
  beforeEach(() => { target = makeTarget(); input = new InputController(target.el); });

  it('increases throttle while W is held', () => {
    target.fire('keydown', { code: 'KeyW' });
    const next = input.applyThrottle(0.5, 0.5);
    expect(next).toBeCloseTo(0.5 + THROTTLE_RATE * 0.5, 5);
  });

  it('decreases while S is held and clamps at 0', () => {
    target.fire('keydown', { code: 'KeyS' });
    expect(input.applyThrottle(0.1, 1)).toBe(0);
  });

  it('clamps at 1', () => {
    target.fire('keydown', { code: 'KeyW' });
    expect(input.applyThrottle(0.95, 1)).toBe(1);
  });

  it('holds throttle when no key is pressed', () => {
    expect(input.applyThrottle(0.42, 1)).toBe(0.42);
  });
});

describe('InputController.consumePointerDelta', () => {
  it('accumulates and resets pointer movement', () => {
    const target = makeTarget();
    const input = new InputController(target.el);
    target.fire('pointermove', { movementX: 3, movementY: -2 });
    target.fire('pointermove', { movementX: 1, movementY: 1 });
    expect(input.consumePointerDelta()).toEqual({ dx: 4, dy: -1 });
    expect(input.consumePointerDelta()).toEqual({ dx: 0, dy: 0 });
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- inputController`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/flight/InputController.ts`:
```ts
export const THROTTLE_RATE = 0.4; // throttle 変化率 [/s]

export class InputController {
  private readonly keys = new Set<string>();
  private pointerDx = 0;
  private pointerDy = 0;

  private readonly onKeyDown = (e: KeyboardEvent) => { this.keys.add(e.code); };
  private readonly onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private readonly onPointerMove = (e: PointerEvent) => {
    this.pointerDx += e.movementX ?? 0;
    this.pointerDy += e.movementY ?? 0;
  };

  constructor(private readonly target: HTMLElement) {
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
    target.addEventListener('pointermove', this.onPointerMove as EventListener);
  }

  applyThrottle(current: number, dtSeconds: number): number {
    let next = current;
    if (this.keys.has('KeyW')) next += THROTTLE_RATE * dtSeconds;
    if (this.keys.has('KeyS')) next -= THROTTLE_RATE * dtSeconds;
    return Math.max(0, Math.min(1, next));
  }

  consumePointerDelta(): { dx: number; dy: number } {
    const d = { dx: this.pointerDx, dy: this.pointerDy };
    this.pointerDx = 0;
    this.pointerDy = 0;
    return d;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
    this.target.removeEventListener('pointermove', this.onPointerMove as EventListener);
  }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- inputController`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/flight/InputController.ts tests/flight/inputController.test.ts
git commit -m "feat: add input controller for throttle and pointer look"
```

---

### Task 10: Picker（レイ最近傍の星を選択）

**Files:**
- Create: `src/selection/Picker.ts`
- Test: `tests/selection/picker.test.ts`

**Interfaces:**
- Consumes: `StarColumns`（Task 2）
- Produces:
  - `function pickStar(cameraPos: [number,number,number], rayDir: [number,number,number],
    columns: StarColumns, maxAngleRad: number): number | null`
  - カメラ位置から各星への方向と `rayDir` の角度が最小、かつ `maxAngleRad` 以内の星の
    インデックスを返す。該当なしは null。`rayDir` は正規化前提。

- [ ] **Step 1: 失敗するテストを書く**

`tests/selection/picker.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pickStar } from '../../src/selection/Picker';

const columns = {
  count: 3,
  x: new Float32Array([10, 0, -10]),
  y: new Float32Array([0, 10, 0]),
  z: new Float32Array([0, 0, 0]),
  mag: new Float32Array([1, 1, 1]), absmag: new Float32Array([1, 1, 1]),
  ci: new Float32Array([0, 0, 0]),
};

describe('pickStar', () => {
  it('selects the star aligned with the ray', () => {
    const idx = pickStar([0, 0, 0], [1, 0, 0], columns, 0.1);
    expect(idx).toBe(0);
  });

  it('selects the +Y star when looking up', () => {
    const idx = pickStar([0, 0, 0], [0, 1, 0], columns, 0.1);
    expect(idx).toBe(1);
  });

  it('returns null when nothing is within the angle threshold', () => {
    const idx = pickStar([0, 0, 0], [0, 0, 1], columns, 0.1);
    expect(idx).toBeNull();
  });

  it('accounts for camera position', () => {
    const idx = pickStar([9, 0, 0], [1, 0, 0], columns, 0.1);
    expect(idx).toBe(0); // star0 at x=10 is directly ahead
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- picker`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/selection/Picker.ts`:
```ts
import type { StarColumns } from '../catalog/format';

export function pickStar(
  cameraPos: [number, number, number],
  rayDir: [number, number, number],
  columns: StarColumns,
  maxAngleRad: number,
): number | null {
  const [cx, cy, cz] = cameraPos;
  let rlen = Math.hypot(rayDir[0], rayDir[1], rayDir[2]) || 1;
  const rx = rayDir[0] / rlen, ry = rayDir[1] / rlen, rz = rayDir[2] / rlen;
  const cosMax = Math.cos(maxAngleRad);
  let bestDot = cosMax;
  let best: number | null = null;
  for (let i = 0; i < columns.count; i++) {
    const dx = columns.x[i]! - cx, dy = columns.y[i]! - cy, dz = columns.z[i]! - cz;
    const len = Math.hypot(dx, dy, dz);
    if (len === 0) continue;
    const dot = (dx * rx + dy * ry + dz * rz) / len;
    if (dot >= bestDot) { bestDot = dot; best = i; }
  }
  return best;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- picker`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/selection/Picker.ts tests/selection/picker.test.ts
git commit -m "feat: add nearest-star ray picker"
```

---

### Task 11: UI 整形関数 + HUD/InfoPanel

**Files:**
- Create: `src/ui/format.ts`, `src/ui/HUD.ts`, `src/ui/InfoPanel.ts`
- Test: `tests/ui/format.test.ts`

**Interfaces:**
- Consumes: `StarCatalog`（Task 7）, `bvToTemperature`（Task 3）,
  `temperatureToSpectralClass`/`parsecsToLightYears`/`absMagToLuminosity`（Task 3）
- Produces:
  - format.ts:
    `formatSpeed(speedC: number): string`（`< 1` は `km/s`、`>= 1` は `×c` 表記）,
    `formatDistanceLy(pc: number): string`,
    `describeStar(columns, index, name): StarInfo`,
    `interface StarInfo { title: string; spectralClass: string; temperatureK: number;
      luminositySun: number; distanceLy: number; isReal: boolean }`
  - HUD.ts: `class HUD { constructor(root: HTMLElement);
    update(speedC: number, isWarp: boolean, target: string | null): void }`
  - InfoPanel.ts: `class InfoPanel { constructor(root: HTMLElement);
    show(info: StarInfo): void; hide(): void }`

生成星（M2）と実在星（M1）で `describeStar` の `title` を切替える: 固有名があればそれ、
なければ `HYG #<index>`。`isReal` は M1 では常に true（カタログ星）。

- [ ] **Step 1: 失敗するテストを書く**

`tests/ui/format.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatSpeed, formatDistanceLy, describeStar } from '../../src/ui/format';

describe('formatSpeed', () => {
  it('shows km/s below light speed', () => {
    expect(formatSpeed(0.5)).toMatch(/km\/s/);
  });
  it('shows multiples of c at or above 1', () => {
    expect(formatSpeed(1000)).toMatch(/×c|c$/);
  });
});

describe('formatDistanceLy', () => {
  it('converts parsecs to light years', () => {
    expect(formatDistanceLy(1)).toMatch(/3\.26/);
    expect(formatDistanceLy(1)).toMatch(/光年/);
  });
});

describe('describeStar', () => {
  const columns = {
    count: 1,
    x: new Float32Array([2.6]), y: new Float32Array([0]), z: new Float32Array([0]),
    mag: new Float32Array([-1.44]), absmag: new Float32Array([1.45]),
    ci: new Float32Array([0.0]),
  };
  it('uses proper name as title when present', () => {
    const info = describeStar(columns, 0, 'Sirius');
    expect(info.title).toBe('Sirius');
    expect(info.isReal).toBe(true);
  });
  it('falls back to HYG index when unnamed', () => {
    const info = describeStar(columns, 0, null);
    expect(info.title).toBe('HYG #0');
  });
  it('computes spectral class and positive distance', () => {
    const info = describeStar(columns, 0, 'Sirius');
    expect(['O','B','A','F','G','K','M']).toContain(info.spectralClass);
    expect(info.distanceLy).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 失敗を確認**

Run: `npm test -- ui/format` もしくは `npm test -- format`（Task 2 の format と両方走るが両方 PASS 目標）
Expected: FAIL（`src/ui/format` 未実装）

- [ ] **Step 3: 実装**

`src/ui/format.ts`:
```ts
import type { StarColumns } from '../catalog/format';
import { bvToTemperature } from '../astro/color';
import {
  temperatureToSpectralClass, parsecsToLightYears, absMagToLuminosity,
} from '../astro/spectral';

export interface StarInfo {
  title: string;
  spectralClass: string;
  temperatureK: number;
  luminositySun: number;
  distanceLy: number;
  isReal: boolean;
}

const C_KM_S = 299792.458;

export function formatSpeed(speedC: number): string {
  if (speedC < 1) return `${Math.round(speedC * C_KM_S).toLocaleString('ja-JP')} km/s`;
  if (speedC < 1000) return `${speedC.toFixed(1)} ×c`;
  return `${speedC.toExponential(1)} ×c`;
}

export function formatDistanceLy(pc: number): string {
  const ly = parsecsToLightYears(pc);
  const shown = ly < 100 ? ly.toFixed(2) : Math.round(ly).toLocaleString('ja-JP');
  return `${shown} 光年`;
}

export function describeStar(columns: StarColumns, index: number, name: string | null): StarInfo {
  const tempK = bvToTemperature(columns.ci[index]!);
  const distPc = Math.hypot(columns.x[index]!, columns.y[index]!, columns.z[index]!);
  return {
    title: name ?? `HYG #${index}`,
    spectralClass: temperatureToSpectralClass(tempK),
    temperatureK: Math.round(tempK),
    luminositySun: absMagToLuminosity(columns.absmag[index]!),
    distanceLy: parsecsToLightYears(distPc),
    isReal: true,
  };
}
```

`src/ui/HUD.ts`:
```ts
import { formatSpeed } from './format';

export class HUD {
  private readonly el: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;left:16px;bottom:16px;color:#cfe4ff;font:14px/1.5 monospace;' +
      'text-shadow:0 0 4px #000;pointer-events:none;';
    root.appendChild(this.el);
  }

  update(speedC: number, isWarp: boolean, target: string | null): void {
    const mode = isWarp ? 'ワープ航行' : '通常航行';
    this.el.innerHTML =
      `速度: ${formatSpeed(speedC)}<br>` +
      `モード: ${mode}<br>` +
      `目標: ${target ?? '—'}`;
  }
}
```

`src/ui/InfoPanel.ts`:
```ts
import { formatDistanceLy } from './format';
import type { StarInfo } from './format';

export class InfoPanel {
  private readonly el: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;right:16px;top:16px;min-width:220px;color:#eaf2ff;' +
      'background:rgba(8,14,28,0.82);border:1px solid #2b4a7a;border-radius:8px;' +
      'padding:12px 16px;font:13px/1.6 system-ui,sans-serif;display:none;';
    root.appendChild(this.el);
  }

  show(info: StarInfo): void {
    const real = info.isReal ? '<span style="color:#7fd1ff">実在</span>' : '生成';
    this.el.innerHTML =
      `<div style="font-size:16px;font-weight:600;margin-bottom:6px">${info.title} ${real}</div>` +
      `スペクトル型: ${info.spectralClass}<br>` +
      `表面温度: ${info.temperatureK.toLocaleString('ja-JP')} K<br>` +
      `光度: 太陽の ${info.luminositySun.toPrecision(3)} 倍<br>` +
      `距離: ${formatDistanceLy(info.distanceLy / 3.2615637769)}`;
    this.el.style.display = 'block';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
```

Note: `InfoPanel.show` は `info.distanceLy`（既に光年）を受け取るが `formatDistanceLy` は
pc を取るため、pc に戻して渡している。整合を保つため、この 1 行は `formatDistanceLy` を使わず
`${Math.round(info.distanceLy).toLocaleString('ja-JP')} 光年` と直接書いてもよい（実装者判断）。

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（全テスト）

- [ ] **Step 5: コミット**

```bash
git add src/ui tests/ui/format.test.ts
git commit -m "feat: add HUD, info panel, and UI formatting helpers"
```

---

### Task 12: app.ts 結線 + メインループ + WebGL2 フォールバック

**Files:**
- Create: `src/app.ts`
- Modify: `src/main.ts`（app 起動に置換）

**Interfaces:**
- Consumes: `Renderer`/`isWebGL2Available`（Task 6）, `FloatingOrigin`（Task 5）,
  `StarCatalog`/`StarField`（Task 7）, `ShipController`（Task 8）, `InputController`（Task 9）,
  `pickStar`（Task 10）, `HUD`/`InfoPanel`/`describeStar`（Task 11）
- Produces: `async function startApp(root: HTMLElement): Promise<void>`

このタスクは結線が中心で純粋ロジックは既存タスクでテスト済みのため、検証は
`npm run build`（型チェック）と `npm run dev` 目視。以下の受入基準を満たすこと。

**受入基準（目視）:**
1. 星が数千〜数万点、色付きで表示される。
2. マウス移動で視点が回り、W/S で throttle が増減し星野が流れる。
3. `NORMAL_BAND` を超えると HUD が「ワープ航行」になり高速移動する。
4. 星をクリックすると InfoPanel に名称・スペクトル型・温度・光度・距離が出る。
5. WebGL2 非対応時は日本語の案内が出る。

- [ ] **Step 1: app.ts を実装**

`src/app.ts`:
```ts
import * as THREE from 'three';
import { Renderer, isWebGL2Available } from './engine/Renderer';
import { FloatingOrigin } from './engine/FloatingOrigin';
import { StarCatalog } from './catalog/StarCatalog';
import { StarField } from './starfield/StarField';
import { ShipController } from './flight/ShipController';
import { InputController } from './flight/InputController';
import { pickStar } from './selection/Picker';
import { HUD } from './ui/HUD';
import { InfoPanel } from './ui/InfoPanel';
import { describeStar } from './ui/format';

const LOOK_SENSITIVITY = 0.0025;
const PICK_ANGLE = 0.01; // rad

function showFatal(root: HTMLElement, message: string): void {
  const div = document.createElement('div');
  div.style.cssText =
    'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
    'color:#eaf2ff;font:16px/1.7 system-ui,sans-serif;text-align:center;padding:24px;';
  div.textContent = message;
  root.appendChild(div);
}

export async function startApp(root: HTMLElement): Promise<void> {
  const probe = document.createElement('canvas');
  if (!isWebGL2Available(probe)) {
    showFatal(root, 'このブラウザは WebGL2 に対応していません。最新の Chrome / Edge / Firefox / Safari でお試しください。');
    return;
  }

  const engine = new Renderer(root);
  const origin = new FloatingOrigin();
  const ship = new ShipController(origin);
  const input = new InputController(engine.renderer.domElement);
  const hud = new HUD(root);
  const panel = new InfoPanel(root);

  engine.renderer.domElement.tabIndex = 0;
  engine.renderer.domElement.style.outline = 'none';
  engine.renderer.domElement.addEventListener('click', () => {
    engine.renderer.domElement.requestPointerLock?.();
  });

  let catalog: StarCatalog;
  let field: StarField;
  try {
    catalog = await StarCatalog.load('/data/hyg.bin', '/data/hyg-names.json');
  } catch {
    showFatal(root, '星カタログの読み込みに失敗しました。`npm run build:catalog` を実行してください。');
    return;
  }
  field = new StarField(catalog.columns);
  engine.scene.add(field.object);

  window.addEventListener('resize', () => engine.resize(window.innerWidth, window.innerHeight));

  // クリックで最近傍の星を選択
  engine.renderer.domElement.addEventListener('pointerdown', () => {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(ship.orientation);
    const idx = pickStar(
      [origin.position[0], origin.position[1], origin.position[2]],
      [dir.x, dir.y, dir.z], catalog.columns, PICK_ANGLE,
    );
    if (idx != null) {
      panel.show(describeStar(catalog.columns, idx, catalog.nameOf(idx)));
    }
  });

  const yawPitch = { yaw: 0, pitch: 0 };
  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    const { dx, dy } = input.consumePointerDelta();
    yawPitch.yaw -= dx * LOOK_SENSITIVITY;
    yawPitch.pitch -= dy * LOOK_SENSITIVITY;
    yawPitch.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, yawPitch.pitch));
    const euler = new THREE.Euler(yawPitch.pitch, yawPitch.yaw, 0, 'YXZ');
    ship.orientation.setFromEuler(euler);

    ship.throttle = input.applyThrottle(ship.throttle, dt);
    ship.update(dt);

    engine.camera.quaternion.copy(ship.orientation);
    field.updateOrigin(origin);

    hud.update(ship.speedC, ship.isWarp, null);
    engine.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
```

`src/main.ts`（置換）:
```ts
import { startApp } from './app';

const root = document.getElementById('app');
if (root) startApp(root);
```

- [ ] **Step 2: 型チェック/ビルド**

Run: `npm run build`
Expected: 型エラーなし、`dist/` 生成。

- [ ] **Step 3: 目視確認**

Run: `npm run build:catalog`（未実行なら）→ `npm run dev`
上記「受入基準（目視）」1〜5 を確認。

- [ ] **Step 4: コミット**

```bash
git add src/app.ts src/main.ts
git commit -m "feat: wire star field, flight, selection, and HUD into main loop"
```

---

### Task 13: 全テスト・型チェック確認とクレジット反映

**Files:**
- Modify: `README.md`（クレジットと操作説明の確定）

**Interfaces:**
- Consumes: なし
- Produces: なし（品質ゲート）

- [ ] **Step 1: 全テスト実行**

Run: `npm test`
Expected: PASS（全 suite）

- [ ] **Step 2: 型チェック**

Run: `npm run build`
Expected: 型エラーなし。

- [ ] **Step 3: README に操作説明とクレジットを追記**

`README.md` の末尾に追記:
```markdown
## 操作

- マウス: 視点（クリックでポインタロック）
- W / S: スロットル増減（0 → 0.999c → ワープ）
- クリック: 正面の星を選択して情報表示

## クレジット

- HYG Database v3 — © astronexus, HYG Database contributors, CC BY-SA 4.0
- 系外惑星データ（M2 以降）— NASA Exoplanet Archive
```

- [ ] **Step 4: コミット**

```bash
git add README.md
git commit -m "docs: finalize M1 controls and data credits"
```

---

## Self-Review（計画作成者による点検結果）

**1. Spec coverage（M1 スコープ）:**
- 星野描画（実データ）: Task 4, 7 ✓
- 自由飛行・ワープ・throttle: Task 8, 9, 12 ✓
- 星選択 + 情報パネル: Task 10, 11, 12 ✓
- スケール（対数深度・floating origin）: Task 5, 6 ✓
- WebGL2 フォールバック / データ読込失敗: Task 6, 12 ✓
- クレジット（HYG CC BY-SA）: Task 1, 13 ✓
- M2〜M4（惑星・銀河生成・相対論演出・図鑑・公開）は本計画のスコープ外。M1 完成後に
  個別計画を作成する（設計書 §8 のマイルストーン準拠）。

**2. Placeholder scan:** 全 step にコード/コマンド実体あり。TBD/TODO なし。

**3. Type consistency:**
- `StarColumns` の形（count,x,y,z,mag,absmag,ci）は Task 2/4/7/10/11 で一貫。
- `describeStar(columns,index,name)` の戻り `StarInfo` は Task 11 定義を Task 12 が消費、一致。
- `ShipController` の `orientation`/`speedC`/`isWarp`/`update` は Task 8 定義を Task 12 が使用、一致。
- `FloatingOrigin.position/translate/relative` は Task 5 定義を Task 7/8/12 が使用、一致。
- `pickStar` 署名は Task 10 定義を Task 12 が使用、一致。
- 既知の軽微点: InfoPanel が光年→pc に戻して `formatDistanceLy` に渡す箇所を Task 11 Note で
  明示済み（実装者が直書きに変更可）。ロジックの正しさには影響しない。

---

## M1 完了後の展望（別計画）

- **M2**: 手続き生成（銀河構造モデル + 決定論シード）、恒星系突入、惑星クローズアップ、
  系外惑星データ結合。
- **M3**: 相対論演出（光行差・ドップラー・ビーミング・時間遅れ HUD）を GLSL とローレンツ計算で。
- **M4**: 発見図鑑（IndexedDB）、銀河マップ、スマホ最小対応、About 画面、Cloudflare Pages 公開。



