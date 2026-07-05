# stellar-voyage 縮尺バー + 局部銀河群（アンドロメダ）模式図 設計

**Goal:** (A) 画面下部に地図的な縮尺バーを常時表示し、現在ズームの実距離を AU/光年/万光年 で示す。(B) 天の川銀河のさらに外へズームすると「局部銀河群」段に入り、天の川銀河とアンドロメダ銀河の位置関係（約250万光年・現在地）を模式図オーバーレイで分かりやすく示す。

## Architecture

いずれも `nav.viewDistanceAu`（既存ズーム状態）に連動。純粋関数で計算・段判定し、薄い DOM で表示、`app.ts` が毎フレーム更新。
- 縮尺バー: 純粋 `scaleBarFor(viewDistanceAu, screenHeightPx, fovYRad)` がカメラ投影から「切りのいい距離」と bar 幅(px)を返す。DOM `ScaleBar` が左下に描画。
- 局部銀河群: 既存 `scaleInfoFor` に 4 段目 `localgroup`（`viewDistanceAu >= 1e10`）を追加。DOM `LocalGroupDiagram`（銀河アイコン2つ＋距離線＋現在地マーカー）を localgroup 段でのみ表示。
- 実データの銀河は無いので、模式図は概念図（3Dシーンと縮尺一致はしない）。

## Global Constraints（プロジェクト既存を継承）

- 全ユーザー向け文言は**日本語**、小学生が読める平易な表現。ワールド単位 **AU**。
- TS strict + `noUncheckedIndexedAccess`。ランタイム依存は Three.js のみ（本機能は純粋ロジック＋DOM、Three 非依存）。`"type":"module"`。
- 純粋ロジックは vitest 単体。バー・模式図・段切替は Playwright 目視（コントローラ）。
- コミットはタスク単位、末尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`、署名エラー時 `git -c commit.gpgsign=false commit`、`--no-verify` 禁止。ビルド系は監査 hook 時 `# CLAUDE_AUDIT_OK`。
- 既存 UI 配置: スケールパネル=左上、InfoPanel/PlanetPanel=右上、速度スライダー=下中央、操作ヒント=右下。**縮尺バーは左下**（非干渉）。全オーバーレイは `pointer-events:none`。

## 既存モジュール（依存/改修）

- `src/ui/format.ts`: `AU_IN_OKUKM = 1.496`（既存 export）
- `src/edu/scaleInfo.ts`: `formatLightTime`, `scaleInfoFor(viewDistanceAu): { stage; title; lines }`。現在 stage は solar/interstellar/galaxy。**本設計で `localgroup` を追加**。
- `src/engine/Renderer.ts`: `camera = PerspectiveCamera(fov=60°, …, far=1e12)`。縦画角 60°。`MAX_VIEW_AU=5e10`（NavigationController）内で 1e10 に到達可能。
- `src/app.ts`: frame ループで `nav.viewDistanceAu`、`engine.camera.fov`、`engine.renderer.domElement.clientHeight` が利用可能。現在ラベル分岐 `} else if (scaleInfo.stage !== 'galaxy') {`。

## Feature A: 縮尺バー

### `src/edu/scaleBar.ts`（純粋・新規）
```
AU_PER_LY = 63241.077
scaleBarFor(viewDistanceAu, screenHeightPx, fovYRad): { label: string; widthPx: number }
```
アルゴリズム:
1. `worldHeightAu = 2 * viewDistanceAu * Math.tan(fovYRad / 2)`（フォーカス面の可視高さ）
2. `pxPerAu = screenHeightPx / worldHeightAu`
3. `rawAu = 160 / pxPerAu`（目標 bar 幅 160px 相当の距離）
4. 単位選択と丸め（`niceRound(x)` = `x` 以下で最大の `{1,2,5}×10ⁿ`）:
   - `rawAu < 6000`（AU 域）: `niceAu = niceRound(rawAu)`、label = `${fmtNum(niceAu)} AU ≈ ${okm}億km（光で ${formatLightTime(niceAu*8.317)}）`（`okm = (niceAu*AU_IN_OKUKM).toPrecision(2)`）、`widthPx = niceAu * pxPerAu`
   - `ly = rawAu/AU_PER_LY < 10000`（光年 域）: `niceLy = niceRound(ly)`、label = `${fmtNum(niceLy)} 光年`、`widthPx = niceLy*AU_PER_LY*pxPerAu`
   - それ以上（万光年 域）: `wan = ly/10000`, `niceWan = niceRound(wan)`、label = `${fmtNum(niceWan)}万光年`、`widthPx = niceWan*10000*AU_PER_LY*pxPerAu`
5. `fmtNum(n)`: 整数は `n.toLocaleString('ja-JP')`、非整数は `String(n)`（niceRound は 1/2/5×10ⁿ なので簡潔）。
- `widthPx` は構造上 [32,160] に収まる（丸めのため）。純粋・テスト可。

### `src/ui/ScaleBar.ts`（DOM・新規）
```
class ScaleBar { constructor(root: HTMLElement); update(bar: { label: string; widthPx: number }): void }
```
- 画面**左下**（`position:fixed;left:16px;bottom:16px;pointer-events:none`）。水平線＋両端の縦チック（幅 = `widthPx`）＋下にラベル。`update` で幅とラベルを反映（`textContent`）。内容不変時は再描画をスキップ（`lastKey` キャッシュ、毎フレーム呼ばれる）。

## Feature B: 局部銀河群（アンドロメダ）模式図

### `src/edu/scaleInfo.ts` 改修（localgroup 段追加）
- 定数 `LOCALGROUP_MIN_AU = 1e10` を追加。`scaleInfoFor` の先頭で `viewDistanceAu >= 1e10` を判定（galaxy より先）:
  - stage `localgroup`、title `局部銀河群`、lines:
    - `銀河が 約50個 集まった なかま`
    - `天の川銀河とアンドロメダ銀河は 約250万光年`
    - `光でも 250万年 かかる きょり`
- 既存 galaxy 判定（`>= 1e6`）はそのまま（`localgroup` を先に返すので galaxy は `1e6 <= v < 1e10`）。既存テスト（`scaleInfoFor(2_000_000)==='galaxy'` 等）は不変で通る。

### `src/ui/LocalGroupDiagram.ts`（DOM・新規）
```
class LocalGroupDiagram { constructor(root: HTMLElement); setVisible(v: boolean): void }
```
- 画面中央付近の概念図（`position:fixed`、中央寄せ、`pointer-events:none`、初期 `display:none`）:
  - 「天の川銀河」 アイコン（楕円＝border-radius の div）＋その下に「↑現在地（太陽系）」マーカー
  - 「アンドロメダ銀河（M31）」 アイコン（楕円 div）
  - 2つを結ぶ横線＋中央に「約250万光年」ラベル
  - 上部見出し「局部銀河群」
- `setVisible(true/false)` で `display` 切替。テキスト（天の川銀河 / アンドロメダ / 約250万光年 / 現在地）を含む。

### `src/app.ts` 結線
- 生成: `const scaleBar = new ScaleBar(root); const localGroup = new LocalGroupDiagram(root);`
- frame ループ（`scaleInfo` 計算の近く）:
  - `scaleBar.update(scaleBarFor(nav.viewDistanceAu, engine.renderer.domElement.clientHeight, engine.camera.fov * Math.PI / 180));`
  - `localGroup.setVisible(scaleInfo.stage === 'localgroup');`
- 星名ラベル省略条件を更新: 現在 `} else if (scaleInfo.stage !== 'galaxy') {` を `} else if (scaleInfo.stage !== 'galaxy' && scaleInfo.stage !== 'localgroup') {` に変更（galaxy に加え localgroup でも星名ラベルを省く。solar/interstellar の既存挙動は不変＝最小変更）。

## 受入基準（目視・コントローラ）

1. 太陽系ビュー: 左下に縮尺バー（例「10 AU ≈ 15億km（光で約83分）」）。ズームすると値が変化。
2. 銀河ズーム: 縮尺バーが「○ 光年」表示に切替。星名ラベルは出ない（galaxy 段）。
3. さらにズームアウトで「局部銀河群」段に入り、中央に模式図（天の川銀河 ⊕現在地 ─約250万光年─ アンドロメダ M31）。左上パネルも局部銀河群の解説。縮尺バーは「○万光年」。
4. すべてクリック・既存パネルを妨げない。

## File Structure
```
src/edu/scaleBar.ts             # 新規（純粋）: scaleBarFor + niceRound
src/edu/scaleInfo.ts            # 改修: localgroup 段追加
src/ui/ScaleBar.ts              # 新規（DOM）: 左下 縮尺バー
src/ui/LocalGroupDiagram.ts     # 新規（DOM）: 局部銀河群 模式図
src/app.ts                      # 改修: scaleBar/localGroup 結線 + ラベル条件更新
tests/edu/scaleBar.test.ts      # 新規
tests/edu/scaleInfo.test.ts     # 追記（localgroup 段）
tests/ui/scaleBar.test.ts       # 新規
tests/ui/localGroupDiagram.test.ts  # 新規
```

## テスト
- `scaleBarFor`: px/AU 計算・単位切替（AU/光年/万光年 の各域で正しい単位ラベル）・丸め（niceRound が 1/2/5×10ⁿ）・widthPx が [32,160]。既知の入力で決定的に検証。
- `niceRound`: 7.4→5、12→10、0.0092→0.005 等。
- `scaleInfoFor`: `1e10` で `localgroup`、`5e9` で `galaxy`、既存段は不変。lines に 250万光年 を含む。
- `ScaleBar` / `LocalGroupDiagram`: DOM 構造・テキスト・可視切替を jsdom で検証（見た目は Playwright）。
