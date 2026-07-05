# stellar-voyage 教育スケールパネル（光速で測る宇宙の規模）設計

**Goal:** ズームアウト（ホイール）で太陽系→銀河へスケールが変わるのに合わせ、画面左上のパネルに「今のスケール名＋端から端の距離＋光でどれくらいかかるか」を小学生にも分かる日本語で常時表示する。銀河スケールでは細かい星名ラベルを省く。

## Architecture

`nav.viewDistanceAu`（既存のズーム状態）を毎フレーム読み、純粋関数 `scaleInfoFor(viewDistanceAu)` が 3 段階のスケールステージ（太陽系 / 太陽系の外・近くの星々 / 天の川銀河）と教育コンテンツ（タイトル＋行）を返す。薄い DOM `ScalePanel` がそれを表示。`app.ts` は毎フレーム更新し、`stage === 'galaxy'` のときは既存の近傍星ラベル描画をスキップする（星の点＝StarField は不変）。光速換算は `1 AU = 8.317 光分` で計算、恒星間は光年を直接使う。

## Global Constraints（プロジェクト既存を継承）

- 全ユーザー向け文言は**日本語**。小学生が読める平易な表現。ワールド単位 AU。
- TS strict + `noUncheckedIndexedAccess`。ランタイム依存は Three.js のみ（この機能は Three 非依存の純粋ロジック＋DOM）。`"type":"module"`。
- 純粋ロジックは vitest 単体。パネル表示・銀河ラベル省略は Playwright 目視（コントローラ）。
- コミットはタスク単位、末尾 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`、署名エラー時 `git -c commit.gpgsign=false commit`、`--no-verify` 禁止。ビルド系は監査 hook 時 `# CLAUDE_AUDIT_OK`。

## スケール3段階（`viewDistanceAu` 閾値。E2E で微調整可）

- **solar**: `viewDistanceAu < 30000`（フェード帯の上端＝太陽系が見えている範囲）
- **interstellar**: `30000 <= viewDistanceAu < 1_000_000`（太陽系を抜け、近くの星が見える）
- **galaxy**: `viewDistanceAu >= 1_000_000`（広い星野＝天の川銀河スケール）

## 教育コンテンツ（各ステージの title + lines、日本語・確定文言）

- **solar** — title `太陽系`:
  - `端から端: 約90億km（海王星の軌道）`
  - `光でも 端から端まで ${formatLightTime(60.2 * LIGHT_MIN_PER_AU)}`（→「約8時間」）
  - `地球から太陽まで 光で ${formatLightTime(1.0 * LIGHT_MIN_PER_AU)}`（→「8分19秒」）
- **interstellar** — title `太陽系の外へ`:
  - `太陽系はこんなに小さい！`
  - `いちばん近い星まで 光で 約4.2年`
  - `光は1秒で地球を7周半`
- **galaxy** — title `天の川銀河`:
  - `星の数 約2000億個`
  - `端から端 約10万光年（光でも10万年）`
  - `太陽もこの中のひとつ`

（solar の光時間・km は定数から計算して確定文字列と一致させる。interstellar/galaxy は固定の教育事実として直書き。）

## Components

### 1. `src/edu/scaleInfo.ts`（純粋・新規）
```
const LIGHT_MIN_PER_AU = 8.317;   // 1 AU を光が進む時間（分）
formatLightTime(lightMinutes: number): string
  // <1分→"N秒" / <60分→"M分S秒"(S=0なら"M分") / <24時間→"約H時間" / <365日→"約D日" / それ以上→"約Y年"
scaleInfoFor(viewDistanceAu: number): { stage: 'solar' | 'interstellar' | 'galaxy'; title: string; lines: string[] }
```
- 閾値は上記。`scaleInfoFor` は各ステージの title/lines を返す。solar の行は `formatLightTime` と `AU_IN_OKUKM`（`ui/format` から import、=1.496）で計算し「約8時間」「8分19秒」「約90億km」に一致させる。
- 純粋・副作用なし・Three 非依存。

### 2. `src/ui/ScalePanel.ts`（DOM・新規）
```
class ScalePanel {
  constructor(root: HTMLElement);
  update(info: { title: string; lines: string[] }): void;
}
```
- 画面左上に `position:fixed;left:16px;top:16px` の半透明パネル（InfoPanel と同系統の見た目、左寄せ）。
- `update` はタイトル（太字）＋各行を `textContent` で書き込む（XSS 回避、内容は固定文言だが一貫して textContent）。内容が変わらない場合の無駄な再描画は許容（毎フレームで軽い）。
- 右上の InfoPanel/PlanetPanel（`right:16px;top:16px`）と重ならない（左上に配置）。

### 3. `src/app.ts`（結線）
- 生成: `const scalePanel = new ScalePanel(root);`（他の UI 生成と同じ場所）。
- frame ループ内、ラベル構築の近くで `const info = scaleInfoFor(nav.viewDistanceAu);` を計算し `scalePanel.update(info);`。
- **銀河ラベル省略**: 既存のラベル分岐 `if (fade > 0.5) { 系ラベル } else { 近傍星ラベル }` の else を `else if (info.stage !== 'galaxy') { 近傍星ラベル }` に変更。galaxy ステージでは星名ラベルを描画しない（StarField の星の点は不変）。

## 受入基準（目視・コントローラ）

1. 起動時（太陽系ビュー）: 左上に【太陽系】パネル。「端から端 約90億km」「光でも約8時間」「地球は光で8分19秒」。
2. ズームアウトしていくと、パネルが【太陽系の外へ】（最も近い星まで光で約4.2年）に変わる。近傍星の名前ラベルは見える。
3. さらにズームアウトすると【天の川銀河】（星の数・10万光年）に変わり、**星名ラベルは消える**（星の点は残る）。
4. パネルはクリック選択や既存パネル（右上）を妨げない。

## File Structure
```
src/edu/scaleInfo.ts           # 新規（純粋）: formatLightTime + scaleInfoFor
src/ui/ScalePanel.ts           # 新規（DOM）: 左上スケールパネル
src/app.ts                     # 改修: ScalePanel 結線 + galaxy ラベル省略
tests/edu/scaleInfo.test.ts    # 新規
```

## テスト
- `formatLightTime`: 8.317分→"8分19秒"、500分→"約8時間"、境界（秒/分/時間/日/年）。
- `scaleInfoFor`: 各閾値でステージが切り替わること（29999→solar、30000→interstellar、1e6→galaxy）、solar の行に "8分19秒"/"約8時間"/"90億km" が含まれること、各ステージの title。
- ScalePanel の表示・ステージ切替・銀河ラベル省略はコントローラが Playwright 目視。
