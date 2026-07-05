# stellar-voyage 星ラベル・距離表示・軌道視認性 設計

**Goal:** 連続ズーム航法 UX に、(1) 銀河ビューでカメラに近い星の名前ラベル、(2) 星系ビューで各惑星の名前＋距離ラベル（＋中央星名）、(3) 太陽系公転軌道リングの視認性向上、を追加する。ラベルは DOM オーバーレイ＋Three カメラ投影（float64）で配置。

## Architecture

既存の単一 AU ワールド（フォーカス星＝scene 原点、カメラは原点を周回）と DOM UI（InfoPanel/PlanetPanel/ControlHints/SpeedSlider）を踏襲。ラベルは新規 `LabelLayer`（DOM プール）が毎フレーム、渡された world 位置を `camera.project()`（内部 float64＝GPU の float32 星描画と違い大スケールでも正確）で画面座標へ変換し配置。`fade = systemFade(viewDistanceAu)` で系ラベルと銀河ラベルを切替。

## Global Constraints（プロジェクト既存を継承）

- 全ユーザー向け文言は**日本語**。ワールド単位 AU、銀河星は pc×AU_PER_PC(206264.8)。フォーカス星が scene 原点。
- TS strict + `noUncheckedIndexedAccess`（配列/Float32Array 添字は `!`）。Three.js のみ。`"type":"module"`。
- 純粋ロジックは vitest 単体。描画・ラベル配置・軌道の見えは Playwright 目視（コントローラ）。
- コミットはタスク単位、末尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`、署名エラー時 `git -c commit.gpgsign=false commit`、`--no-verify` 禁止。ビルド系は監査 hook 時 `# CLAUDE_AUDIT_OK`。

## Components

### 1. `src/nav/nearestStars.ts`（純粋・新規）
`nearestStarPc` の N 個版。
```
nearestStarsPc(focusPc: [number,number,number], columns: StarColumns, count: number): { index: number; distPc: number }[]
```
- focusPc に近い順（距離昇順）の最大 count 星を返す。count<=0 は空配列。count>=columns.count は全星。
- 実装: 全星を走査し、距離二乗で上位 count を保持（小さな挿入ソート、O(n·count)）。返す distPc は `Math.sqrt`。
- 既存 `nearestStarPc` は据え置き（app.ts のフォーカス切替が使用）。本関数は独立。

### 2. `src/ui/format.ts` に距離整形を追加
```
formatAuDistance(au: number): string   // 例: "1.0 AU ≈ 1.5億km"
```
- `AU_IN_OKUKM = 1.496`（1 AU = 1.496×10^8 km = 1.496 億km）。
- 返り値 `` `${au.toPrecision(3)} AU ≈ ${(au * AU_IN_OKUKM).toPrecision(2)}億km` ``。
- 既存 `PARSEC_IN_LY`（astro/spectral, =3.2615637769）で星の光年は `distPc * PARSEC_IN_LY`。星ラベルの距離文字列はこの節では作らず、app.ts 側で `` `${ly.toFixed(1)} 光年` `` を組む（describeStar と重複を避けるため薄く）。

### 3. `src/ui/LabelLayer.ts`（新規・DOM）
```
type LabelItem = { text: string; worldPos: [number, number, number] };
class LabelLayer {
  constructor(root: HTMLElement);
  render(items: LabelItem[], camera: THREE.Camera, domEl: HTMLElement): void;
}
```
- 内部に `<div>` ラベル要素のプールを保持。`render` 毎フレーム: 各 item の worldPos を `new THREE.Vector3(...worldPos).project(camera)` で NDC 化。
- 画面外/背後は非表示: `ndc.z < -1 || ndc.z > 1 || |ndc.x|>1.05 || |ndc.y|>1.05` → その要素 `display:none`。
- 画面内: `left = (ndc.x*0.5+0.5)*domEl.clientWidth`, `top = (-ndc.y*0.5+0.5)*domEl.clientHeight`。`transform: translate(...)` で配置、`display:block`。
- items 数が現プールより多ければ要素追加、少なければ余りを非表示（要素は破棄せず再利用）。
- スタイル: `position:fixed; color:#dCE8ff; font:11px system-ui; text-shadow:0 0 3px #000; pointer-events:none; white-space:nowrap;`。小さな点＋右にテキスト（`translate(-50%,…)` で点中心合わせ）。`pointer-events:none` でクリック選択を邪魔しない。
- テキストの挿入は `textContent`（XSS 回避。星名はカタログ由来だが一貫して textContent）。

### 4. `src/system/SystemScene.ts` 改修（軌道リング視認性）
現行: `RingGeometry(a-0.004, a+0.004, 128)`＋`MeshBasicMaterial(color:0x2b4a7a, opacity:0.5)`（細く暗く見えにくい）。
改修:
- 幅を半径依存に: 内外半径 `a ± max(0.01, a*0.01)`（大きい軌道ほど太く、常に視認可能）。
- 色を惑星型色に: `planetTypeColor(p.type)`。opacity `0.85`。`side: DoubleSide` 維持。
- 惑星本体・環（土星）・中央星は不変。`planetMeshes` にリングは追加しない（選択対象は本体のみ、既存どおり）。

### 5. `src/app.ts` 結線
- 生成: `const labels = new LabelLayer(root);`。
- frame ループ末尾付近（カメラ更新後）でラベル item を構築し `labels.render(items, engine.camera, engine.renderer.domElement)`:
  - `fade > 0.5`（系可視）: 中央星（`worldPos:[0,0,0]`, `text: currentSystem.starName`）＋各惑星（`worldPos: orbitPosition(p.semiMajorAxisAu, planetPhase(currentSystem.starIndex, i))`, `text: `${p.name}  ${formatAuDistance(p.semiMajorAxisAu)}` `）。
  - それ以外（銀河）: `nearestStarsPc(fp, catalog.columns, 15)` の各星について、scene 位置 `worldPos = [(x-fp0)*AU_PER_PC, (y-fp1)*AU_PER_PC, (z-fp2)*AU_PER_PC]`（fp = focusWorldAu/AU_PER_PC、columns から x,y,z）、`text = `${catalog.nameOf(idx) ?? 'HYG #'+idx}  ${(distFromSolPc*PARSEC_IN_LY).toFixed(1)} 光年` `（distFromSolPc = hypot(columns[idx]) ＝太陽 index0 は原点なので星の pc ノルム）。LabelLayer が画面外を間引くので 15→表示は実質最大 ~12。
- ラベル距離の意味: **銀河ラベルの光年は「太陽（Sol, index0）からの距離」**（"シリウス 8.6光年" 等の直感に合わせる）。近さ判定（どの星を出すか）は focusPc 基準。

## 表示切替と受入基準（目視・コントローラ）

1. 太陽系ビュー: 各惑星のそばに「名前＋AU＋億km」（地球=1.0 AU ≈ 1.5億km）、中央に星名。軌道リングが明るく惑星色で見やすい。
2. ズームアウトで銀河へ: 系ラベルが消え、カメラ近傍の星に「名前 or HYG #idx＋光年」ラベル。名前付きの主要星・近傍星が読める。
3. ドラッグ/WASD/ズームでラベルが星・惑星に追従、画面外に出たものは消える。クリック選択を妨げない（pointer-events:none）。

## File Structure
```
src/nav/nearestStars.ts        # 新規（純粋）
src/ui/LabelLayer.ts           # 新規（DOM）
src/ui/format.ts               # formatAuDistance 追加
src/system/SystemScene.ts      # 軌道リング改修
src/app.ts                     # LabelLayer 結線
tests/nav/nearestStars.test.ts # 新規
tests/ui/format.test.ts        # formatAuDistance ケース追記
```

## テスト
- `nearestStarsPc`: 近い順・件数上限・count 0/超過の境界。
- `formatAuDistance`: 1 AU→"1.5億km" 含む、AU/億km 併記フォーマット。
- LabelLayer 投影・軌道リングの見え・追従はコントローラが Playwright 目視。
