# stellar-voyage 太陽の銀河公転（道を流す）＋一時停止 設計

**Goal:** 太陽系ビューで「太陽自身も銀河を移動している」ことを描写する。太陽は中心（原点）に静止したまま、既存の銀河公転の道すじ（金の弧）に沿って**道標マーカーを進行方向の逆へ流し**（車と道路の関係）、太陽が進んでいると見せる。加えて**一時停止トグル（⏸/▶ ボタン＋Space キー）**で公転アニメと道流しを止め、静止した惑星を狙ってクリックできるようにする。

## Architecture

- 現状: `SystemScene` は starIndex 0 のとき金の弧（`THREE.Line`）を1本描くだけ（静止）。`app.ts` は `animT` を毎フレーム累積し、惑星の公転・ラベル・クリックを駆動。
- 追加: **太陽系のみ**、金の弧に沿って流れる**道標マーカー群**（小球）＋**小さな進行方向の矢印**を `SystemScene` に足し、`update(t)` で `animT` に連動して流す。太陽の常時ラベルを「銀河を移動中」を伝える文言に更新。
- 一時停止: `app.ts` に `paused` フラグ。`if (!paused) animT += dt;` に変更するだけで、**惑星公転・道流し・ラベル・クリックが同じ `animT` を共有しているため一括で凍結**。視点操作（ドラッグ/ズーム/WASD）とクリックは `paused` に関係なく有効。停止で惑星が止まり狙いやすい。

## Global Constraints（プロジェクト既存を継承）

- ユーザー向け文言は日本語。ワールド単位 AU。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。純粋ロジックは vitest 単体、動き・見た目・操作は Playwright 目視（コントローラ）。
- 実装ポリシー: **TDD厳密**=道すじの弧点・マーカーの流れ位相（範囲/等間隔/流れ方向/周期）、pause トグル状態と「pause 中 animT 不変」。**実機調整**=流す速度・マーカー数/サイズ・矢印/ラベルの見え方・ボタン配置（テストで具体値を固定しない）。
- コミット末尾 `Co-Authored-By: Claude <実装モデル> <noreply@anthropic.com>`、署名エラー時 `git -c commit.gpgsign=false commit`、`--no-verify` 禁止。ビルド系は監査 hook 時 `# CLAUDE_AUDIT_OK`。

## 新規純関数モジュール `src/system/galacticPath.ts`

金の弧（既存 `SystemScene` の R=40, a∈[-π/3, π/3], 太陽=a=0=原点）を共有し、道標の流れを純関数化。

```ts
export const GAL_PATH_R = 40;                 // 弧半径（AU, 見栄え）
export const GAL_ARC_SPAN = (2 * Math.PI) / 3; // 弧の全角 120°（a∈[-π/3, π/3]）

/** 弧パラメータ a での道すじ座標（0.35 の傾き適用前。太陽=a=0=原点）。 */
export function galacticPathPoint(a: number, R = GAL_PATH_R): [number, number, number] {
  return [R * Math.sin(a), 0, -R + R * Math.cos(a)];
}

/**
 * 道標マーカー k（全 count 個, 等間隔）の時刻 t での弧パラメータ。
 * 前方(+π/3)→太陽(0)→後方(-π/3) へ流れてループ（車と道路）。flowSpeed rad/秒。
 * 返り値は (-π/3, π/3] にラップ。
 */
export function galacticMarkerParam(k: number, count: number, t: number, flowSpeed: number): number {
  const raw = (k / count) * GAL_ARC_SPAN + t * flowSpeed;
  const wrapped = ((raw % GAL_ARC_SPAN) + GAL_ARC_SPAN) % GAL_ARC_SPAN; // [0, SPAN)
  return Math.PI / 3 - wrapped;                                          // [+π/3 .. -π/3)（減少＝後方へ流れる）
}
```

- 弧点・傾き（rotation.x=0.35）は既存の金の弧と一致させ、マーカーが線上に乗るようにする。
- 進行方向（forward）: a=0 の接線 = +X（rotation.x では X 不変）。小矢印はこの方向。

## `SystemScene` 改修（太陽系のみ）

- 金の弧生成を `galacticPathPoint` 利用に置換（挙動同一）。既存の弧はそのまま描く。
- **道標マーカー群**: `count`(≈6) 個の小球（`SphereGeometry` 半径≈0.4AU, 金系・半透明）を、弧と同じ `rotation.x=0.35` のグループ配下に追加。参照を配列保持。
- **小さな進行方向の矢印**: 太陽（原点）から forward(+X, 弧と同じ傾き)へ短い矢印（`ArrowHelper` 長さ≈5AU・細め・淡い金）。※以前削除した「大きな矢印」とは別物（小さく道すじ上の進行方向を示す）。見え方次第で調整/除去可（live-tune）。
- `update(t)`: 既存の惑星更新に加え、各道標 k の位置を `galacticPathPoint(galacticMarkerParam(k, count, t, GAL_FLOW_SPEED))` に設定（グループが傾きを持つのでローカル座標でよい）。太陽・惑星・軌道リング・金の弧本体・矢印は不動（矢印は方向固定）。
- `GAL_FLOW_SPEED` は `SystemScene`（or galacticPath）定数・live-tune。
- 太陽系以外（starIndex≠0）ではマーカー/矢印を作らない（現状維持）。

## 太陽ラベル文言（`app.ts`）

- 現行の太陽常時ラベル「太陽 ・ 公転 220km/s（クリックで詳細）」を、移動を伝える文言へ：
  **「太陽 ・ 銀河を 220km/s で移動中（クリックで詳細）」**（数値・クリック導線は不変）。

## 一時停止（`app.ts` + `InputMapper` + 新規 `PauseButton`）

- `src/ui/PauseButton.ts`（新規）: 画面固定の小ボタン（下中央スライダー付近, 既存 UI と同系のスタイル）。状態を反映（再生中「⏸ 停止」/ 停止中「▶ 再生」）。`onToggle` コールバック。クリックは canvas に伝播させない（`stopPropagation`）＝停止操作で惑星選択が起きない。
- `src/nav/InputMapper.ts`: Space のエッジ検出を追加。`onKeyDown` で **`e.code==='Space'` かつ まだ `keys` に無い（=物理的初回押下, auto-repeat 除外）**とき `pauseToggleRequested=true`＋`preventDefault`（判定は `keys.add` の前に行う）。`consumePauseToggle(): boolean` で一度だけ true を返し即 false に戻す。押しっぱなしでは再発火しない（keyup で `keys` から抜けて次の押下で再びエッジ）。
- `src/app.ts`:
  - `let paused = false;` と `setPaused(v)`（`paused` 更新＋`PauseButton` の表示更新）。`togglePause()`。
  - frame: `if (!paused) animT += dt;`（他は不変。`systemScene.update(animT)`・ラベル・`pickPlanet(...,animT)` は据え置き＝凍結）。
  - `if (input.consumePauseToggle()) togglePause();`。`PauseButton` の `onToggle` も `togglePause`。
  - 視点（ドラッグ/ズーム/WASD）・クリック選択は `paused` に非依存で有効。

## 受入基準（目視・コントローラ）

1. 太陽系ビューで**太陽は中心に静止**したまま、金の道すじ上を**道標が前方→後方へ流れる**（太陽が進んでいると読める）。小さな進行方向の矢印＋「銀河を 220km/s で移動中」ラベル。
2. **⏸ ボタン**（または **Space**）で公転アニメと道流しが**止まる**。▶（または Space）で再開。停止/再生でボタン表示が切り替わる。
3. 停止中に**惑星をクリックで選択**でき正しいパネルが出る（動作中もクリックは効くが停止で確実に）。停止操作自体では選択が起きない。
4. 手続き系（starIndex≠0）では道標/矢印は出ない・従来通り。停止は全系で効く。

## File Structure
```
src/system/galacticPath.ts       # 新規: galacticPathPoint, galacticMarkerParam, 定数
src/system/SystemScene.ts        # 改修: 道標マーカー群+小矢印(solar), update(t) で道標を流す
src/ui/PauseButton.ts            # 新規: ⏸/▶ トグルボタン
src/nav/InputMapper.ts           # 改修: Space のエッジ (consumePauseToggle)
src/app.ts                       # 改修: paused/togglePause・animT ゲート・PauseButton/Space 結線・太陽ラベル文言
tests/system/galacticPath.test.ts   # 新規: 弧点・マーカー流れ位相
tests/nav/inputMapper.test.ts       # 追記/新規: consumePauseToggle エッジ
tests/system/systemScene.test.ts    # 追記: solar で update(t) 後に道標メッシュが動く
```

## テスト
- `galacticPathPoint`: a=0 で [0,0,0]（太陽）、a=π/3 で [R·sin60°,0,-R+R·cos60°]。
- `galacticMarkerParam`: 返り値 (-π/3, π/3]。t=0 で k 等間隔。固定 k で t 微増→値が減少（後方へ流れる, ラップ前）。周期 `GAL_ARC_SPAN/flowSpeed` で同値（toBeCloseTo）。
- `InputMapper.consumePauseToggle`: Space keydown 後に一度だけ true、その後 false。無押下では false。
- `SystemScene.update(t)`（solar）: `update(0)` と `update(t>0)` で道標メッシュ位置が変化。値の厳密固定はしない。
- Playwright E2E: 受入基準 1〜4。流す速度・矢印/ラベルの見え方は live-tune。
