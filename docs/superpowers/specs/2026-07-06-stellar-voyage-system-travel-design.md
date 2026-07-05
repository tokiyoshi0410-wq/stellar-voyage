# stellar-voyage 太陽系ごと銀河の道を旅する（system travel）設計

**Goal:** 太陽系ビュー（solar のみ）で、太陽系全体（太陽＋惑星＋軌道リング）が金の「銀河公転の道」に沿って画面内を進む（端で画面外ループ・中心も通る）。惑星は**動く太陽**を公転し螺旋状の軌跡になる。道の上に置いた固定の道標を系が通り過ぎて移動が分かる。ラベル・クリック判定はワールド座標で移動する系に追従。一時停止（既存）で系の移動も含め全凍結し、狙ってクリックできる。

これは先の「太陽は中心固定・道標を流す」方式（user が『イメージと違う』と却下）を、**系そのものが道を進む**方式へ作り替えるもの。**一時停止（PauseButton＋Space）は既存のまま流用**。手続き系（starIndex≠0）は従来どおり中心固定・非トラベル。

## Architecture

現状 `SystemScene.root` 直下に 太陽・惑星・軌道リング・金の道・道標・PointLight を配置。惑星は `orbitPosition` のローカル座標で置き、`app.ts` のラベル/クリックは**ローカル座標を再計算**（root=原点前提）。

方針:
- **`travelGroup`（新設, root の子）** に 太陽・惑星・軌道リング・土星の環・PointLight を収容。金の道（線）と固定道標は **root 直下（不動＝道は固定）**。
- `update(t)`: solar のとき `travelGroup.position = galacticPathPoint(systemTravelParam(t, SYSTEM_TRAVEL_SPEED))`（flat, y=0）。惑星は travelGroup 内でローカル公転（`animatedPhase`, 従来どおり）。→ ワールドでは公転＋並進＝螺旋。道標は**固定**（flow 廃止）。非solar は travelGroup 原点固定。
- 金の道・軌道・travel を **同一 XZ 平面**に揃えるため、金の道と道標の `rotation.x = 0.35` 傾きは**廃止**（系が道の上を進むため）。
- **ラベル/クリックはワールド座標**へ: `travelGroup` のオフセットを含む実位置を使う。`SystemScene` が `planetWorldPos(i)` / `sunWorldPos()`（＝travelGroup 位置）を公開、`app.ts` がそれを使う。`pickPlanet` はワールド座標配列を受け取る形へ改修。太陽クリックの角度判定も太陽ワールド位置ベースに。

## Global Constraints（プロジェクト既存を継承）

- ユーザー向け文言は日本語。ワールド単位 AU。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。純粋ロジックは vitest 単体、動き・クリック追従は Playwright 目視（コントローラ）。
- 実装ポリシー: **TDD厳密**=`systemTravelParam`（t=0=中心・進行方向・範囲・ループ周期）、`SystemScene.update(t)` で travelGroup と惑星ワールド位置が動く／道標は固定／非solar は非トラベル、`pickPlanet`（ワールド座標配列で選択）。**実機調整**=`SYSTEM_TRAVEL_SPEED`・進む範囲（画面内に収める量）・道標の見え方（テストで具体値を固定しない）。
- コミット末尾 `Co-Authored-By: Claude <実装モデル> <noreply@anthropic.com>`、署名エラー時 `git -c commit.gpgsign=false commit`、`--no-verify` 禁止。ビルド系は監査 hook 時 `# CLAUDE_AUDIT_OK`。

## 新規純関数（`src/system/galacticPath.ts` に追加）

```ts
export const SYSTEM_TRAVEL_SPEED = 0.05; // rad/秒（実機調整・ゆっくり旅する）

/**
 * 太陽系が金の道を進む弧パラメータ。t=0 で 0（中心）、時間とともに -π/3 へ進み、
 * +π/3 側から再入してループ（画面外で折返し・中心を周期的に通る）。範囲 [-π/3, π/3]。
 */
export function systemTravelParam(t: number, speed: number): number {
  const raw = (((t * speed + Math.PI / 3) % GAL_ARC_SPAN) + GAL_ARC_SPAN) % GAL_ARC_SPAN; // [0, SPAN)
  return Math.PI / 3 - raw; // t=0 → 0（中心）; 増加で -π/3 へ, ラップで +π/3 から
}
```

（既存 `galacticPathPoint`/`galacticMarkerParam`/`GAL_ARC_SPAN` は流用。`galacticMarkerParam` は道標を固定配置する初期値算出にのみ使用＝flow はやめる。）

## `SystemScene` 改修

- `travelGroup = new THREE.Group()` を root に add。太陽メッシュ・各惑星メッシュ・軌道リング・土星の環・PointLight は **travelGroup** に add（従来 root へ add していた分を移す）。
- 金の道（線, flat=傾き無し）と道標（固定, flat）は **root** に add。道標は構築時の `galacticPathPoint(galacticMarkerParam(k, GAL_MARKER_COUNT, 0, GAL_FLOW_SPEED))` に置いたまま**動かさない**。
- `readonly galMarkers` は残すが `update` で動かさない（固定）。
- `update(t)`:
  - 惑星ローカル公転（従来どおり `planetMeshes[i].position = orbitPosition(a, animatedPhase(...))`）。
  - **solar のみ**: `travelGroup.position.set(...galacticPathPoint(systemTravelParam(t, SYSTEM_TRAVEL_SPEED)))`（y=0）。非solar は travelGroup を原点のまま。
  - 道標は更新しない。
- 公開メソッド:
  - `planetWorldPos(i): [number, number, number]`（`planetMeshes[i].getWorldPosition(scratch)`）
  - `sunWorldPos(): [number, number, number]`（太陽メッシュ or travelGroup の world 位置）
  - （`updateWorldMatrix(true,true)` を呼んでから getWorldPosition）

## `pickPlanet` 改修（ワールド座標）

```ts
pickPlanet(cameraPos, rayDir, positions: readonly [number,number,number][], maxAngleRad): number | null
```
- `positions[i]` を各惑星のワールド位置として角度選択（既存 cos 判定はそのまま、内部の位相再計算を除去）。`t` 引数は廃止。
- `app.ts` が `currentSystem.planets.map((_,i)=>systemScene.planetWorldPos(i))` を渡す。

## `app.ts` 結線

- ラベル（system view）: 惑星 worldPos = `systemScene.planetWorldPos(i)`。太陽ラベル worldPos = `systemScene.sunWorldPos()`（従来 [0,0,0] 固定をやめる）。文言は「太陽 ・ 銀河を 220km/s で移動中（クリックで詳細）」のまま。
- クリック（惑星）: `pickPlanet([cam], rayDir, planetWorldPositions, PLANET_PICK_ANGLE)`。
- クリック（太陽）: 現行の「原点方向」角度判定を**太陽ワールド位置方向**に変更。`sunWorld = systemScene.sunWorldPos()`; カメラ→太陽方向 `d = normalize(sunWorld - camAu)`; `dot(d, rayDir) > cos(SUN_PICK_ANGLE)` で太陽クリック。
- pause（既存）: `if(!paused) animT += dt;` のまま。travelGroup も animT 駆動なので一括凍結。

## 受入基準（目視・コントローラ）

1. 太陽系ビューで**太陽系全体（太陽＋惑星＋軌道）が金の道に沿って進む**（画面内を移動し中心も通る）。惑星は動く太陽を公転（螺旋）。固定道標を通り過ぎる。
2. 移動中の**惑星をクリックで選択**でき正しいパネル。**太陽をクリック**で銀河公転パネル（太陽が動いていても当たる）。
3. **⏸/Space で停止**すると系の移動・公転が止まり、静止状態で惑星/太陽をクリックできる。▶/Space で再開。
4. 手続き系（starIndex≠0）は従来どおり中心固定・非トラベル・道標無し。

## File Structure
```
src/system/galacticPath.ts       # 追加: systemTravelParam, SYSTEM_TRAVEL_SPEED
src/system/SystemScene.ts        # 改修: travelGroup 収容・道標固定・update で travel・傾き廃止・world 位置公開
src/system/planetPick.ts         # 改修: ワールド座標配列で選択（t 廃止）
src/app.ts                       # 改修: ラベル/クリック/太陽クリックを world 位置ベースに
tests/system/galacticPath.test.ts   # 追記: systemTravelParam
tests/system/systemScene.test.ts    # 追記: update(t) で travelGroup/惑星 world 位置が動く・道標固定・非solar 非トラベル
tests/system/planetPick.test.ts     # 改修: ワールド座標配列シグネチャ
```

## テスト
- `systemTravelParam`: t=0 で 0（中心）、t 増で減少（-π/3 方向へ進む・ラップ前）、範囲 [-π/3, π/3]、周期 `GAL_ARC_SPAN/speed` で同値。
- `SystemScene.update(t)`（solar）: `update(0)`→`update(t>0)` で `sunWorldPos()`（travelGroup）と `planetWorldPos(0)` が変化。道標メッシュ位置は不変。非solar: `sunWorldPos()` は原点のまま。
- `pickPlanet`（新シグネチャ）: 与えたワールド位置配列に対しレイ最近を返す・範囲外 null。既存テストを配列渡しに更新。
- Playwright E2E: 受入基準 1〜4。旅する速度・範囲は live-tune（画面内に収まるよう調整）。
