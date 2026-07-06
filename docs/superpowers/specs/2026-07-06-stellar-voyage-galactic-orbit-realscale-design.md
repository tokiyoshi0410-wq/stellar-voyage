# stellar-voyage 太陽の銀河公転を実スケールで（銀河ビュー）設計

**Goal:** 太陽の銀河公転を「実際のスケール」で表現する。太陽系ビューの模式円（実スケールではない・約5,500万倍の乖離）は撤去し、**銀河（天の川）ビューで、太陽の銀河公転軌道を実比率の円で描き、天の川がゆっくり自転**する。太陽（現在地）は中心に固定（ズーム操作・二重太陽問題を回避）。ラベルで「約2.3億年で1周・半径約2.6万光年」を明示。

user 承認済み方針（AskUserQuestion「軌道円＋銀河の自転」）。太陽系ビューは惑星の公転アニメと一時停止（既存）を維持し、銀河公転の描画のみ銀河ビューへ移す。

## 背景（なぜ）

太陽の銀河公転半径は約2.6万光年 ≈ 16億AU。惑星軌道は最大30AU。比率は約5,500万倍で、太陽系ビューに円として描くのは物理的に不可能（円は直線に見え、太陽の動きも知覚不能）。一方、銀河ビューでは天の川半径 `MILKY_WAY.radiusAu`=4e9 に対し太陽の銀河中心距離 `SUN_DISK_OFFSET`=radiusAu×0.55≈2.2e9 で、これは実際の太陽位置（銀河半径の約52%）とほぼ一致するため、**実比率の公転軌道円を描ける**。

## Architecture

- **Part A（撤去/リバート）**: `SystemScene` の太陽の金色の公転円・道標・系トラベル（`setTravelAngle`）を削除。太陽は中心静止。`app.ts` の太陽トラベル結線と `galacticPath.ts`（＋テスト）を削除。太陽ラベルを「移動中」から戻す。
- **Part B（銀河ビューに追加）**: `LocalGroup` に太陽の公転軌道円（銀河中心中心・半径 `SUN_DISK_OFFSET`・天の川円盤面内）を描き、`update(t)` で天の川円盤を面内自転させる。太陽（現在地マーカー）は原点固定（円周上）。`app.ts` が毎フレーム `localGroup.update(animT)` を呼び、軌道ラベルを追加。

## Global Constraints（プロジェクト既存を継承）

- ユーザー向け文言は日本語。ワールド単位 AU。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。純粋/構造ロジックは vitest、見た目・動きは Playwright 目視（コントローラ）。
- 実装ポリシー: **TDD厳密**=構造不変（SystemScene に金色円/道標が無い・LocalGroup に軌道円メッシュが在る・`update(t)` で天の川の回転が変化）。**実機調整**=自転速度・軌道円の色/太さ・ラベル位置（値を assert しない）。
- コミット末尾 `Co-Authored-By: Claude <実装モデル> <noreply@anthropic.com>`、署名エラー時 `git -c commit.gpgsign=false commit`、`--no-verify` 禁止。ビルド系は監査 hook 時 `# CLAUDE_AUDIT_OK`。

## Part A: 太陽系ビューの模式円を撤去

### `src/system/SystemScene.ts`
- `if (system.starIndex === 0) { ... }` ブロック（金色の公転円 orbitLine + 道標 markerGroup/galMarkers 生成）を**丸ごと削除**。
- `galMarkers` フィールド・`setTravelAngle` メソッドを削除。`galacticPath` からの import を削除。
- `travelGroup` は**残す**（太陽・惑星・軌道リング・PointLight を収容したまま・原点に固定＝二度と動かさない）。`planetWorldPos`/`sunWorldPos` はそのまま（travelGroup 原点なので局所位置＝ワールド位置で正しい）。→ app.ts のラベル/クリックの world 位置ベース結線は不変で動作。
- 太陽は中心に静止（惑星の公転アニメ `update(t)` の惑星ループは維持）。

### `src/app.ts`
- frame 内の太陽トラベル結線（`const inSolarView = ...; systemScene.setTravelAngle(...)`）を**削除**。`import { SYSTEM_TRAVEL_SPEED } from './system/galacticPath';` を削除。
- 太陽ラベル文言を戻す：`太陽 ・ 銀河を ${SUN_FACTS.galacticSpeedKmS}km/s で移動中（クリックで詳細）` → **`太陽 ・ 公転 ${SUN_FACTS.galacticSpeedKmS}km/s（クリックで詳細）`**。worldPos は `ss.sunWorldPos()` のまま（原点）。
- 停止ボタン（PauseButton）＋ `if(!paused) animT += dt` は維持（惑星公転の一時停止として機能）。

### 削除
- `src/system/galacticPath.ts` と `tests/system/galacticPath.test.ts` を削除（Part A 後は未使用）。

## Part B: 銀河ビューで実スケール銀河公転

### `src/galaxy/LocalGroup.ts`
- **太陽の公転軌道円**（`THREE.Line` フル円）を追加：半径 `SUN_DISK_OFFSET` の円（局所 XZ 平面 `SUN_DISK_OFFSET*(cos a,0,sin a)`, a∈[0,2π]）を、銀河中心 `(-SUN_DISK_OFFSET,0,0)` に配置＋`rotation.x=0.5`（天の川円盤と同一平面）。→ 太陽（group 原点）は a=0 でこの円上に乗る。淡い金色・半透明。group の子（**自転しない**＝軌道は固定パス）。参照を保持。
- **天の川の面内自転**: 天の川円盤（XZ 生成・法線=局所Y）を面内で回すため `this.milkyWay.object.rotation.order = 'YXZ'` にし、`rotation.x=0.5`（傾き）維持のまま `update(t)` で `this.milkyWay.object.rotation.y = GALAXY_SPIN_SPEED * t` を設定（Y=面内自転を先に、X=傾きを後に適用）。※軸/order は実機で「腕が面内で回る（円盤がぐらつかない）」ことを確認し調整可（live-tune）。`GALAXY_SPIN_SPEED`≈0.1 rad/秒（live-tune）。
- `update(t: number): void` を追加（上記の自転設定）。`galacticCenterWorldPos(): [number,number,number]`（天の川 `milkyWay.object` の world 位置）を追加（ラベル位置用）。
- `setOpacity(o)` で軌道円の opacity も設定。`dispose()` で軌道円を破棄。
- マーカー（現在地=太陽）は原点のまま（変更なし）。軌道円は固定・太陽固定・腕が回る＝銀河公転を表現。

### `src/app.ts`
- frame の localGroup 配置付近（`localGroup.setPosition(...)` の後）で毎フレーム `localGroup.update(animT);` を呼ぶ（`animT` 駆動＝停止ボタンで銀河自転も止まる・一貫）。
- 局部銀河群ラベル（`現在地（太陽系）`/`約250万光年` を push している箇所）に**銀河公転ラベル**を追加：
  `太陽の銀河公転 ・ 約${(SUN_FACTS.galacticPeriodYr/1e8).toPrecision(2)}億年で1周（半径約${(SUN_FACTS.galacticCenterLy/1e4).toFixed(1)}万光年）`、worldPos = `localGroup.galacticCenterWorldPos()`。

## 受入基準（目視・コントローラ）

1. **太陽系ビュー**: 太陽の金色の公転円・道標が**無い**。太陽は中心に静止。惑星の公転アニメは動く。停止ボタンで惑星公転が止まりクリック可。太陽ラベルは「太陽 ・ 公転 220km/s（クリックで詳細）」。
2. **銀河ビュー**（ズームアウトで天の川を見た状態）: 太陽の**公転軌道円**が天の川内に実比率で描かれ、太陽（現在地）が円上・中心に固定。**天の川がゆっくり自転**（腕が回る）。ラベル「太陽の銀河公転 ・ 約2.3億年で1周（半径約2.6万光年）」。
3. 停止ボタンで銀河ビューの自転も止まる（animT 連動）。
4. 既存の局部銀河群表示（天の川/アンドロメダ/現在地/約250万光年・クロスフェード）は不変。

## File Structure
```
src/system/SystemScene.ts        # 改修: 金色円/道標/setTravelAngle 削除・太陽静止
src/app.ts                       # 改修: 太陽トラベル結線削除・太陽ラベル復帰・localGroup.update(animT)・銀河公転ラベル
src/galaxy/LocalGroup.ts         # 改修: 太陽公転軌道円 + update(t) 自転 + galacticCenterWorldPos
（削除）src/system/galacticPath.ts / tests/system/galacticPath.test.ts
tests/system/systemScene.test.ts # 改修: 道標/travel テスト削除・「金色円/道標が無い」を確認
tests/galaxy/localGroup.test.ts  # 追加/改修: 軌道円メッシュ在り・update(t) で天の川回転が変化
```

## テスト
- `SystemScene`（solar）: 構築後、root/travelGroup 配下に `THREE.Line`（金色公転円）が無い・`galMarkers` が無い（フィールド削除）。惑星メッシュ・軌道リングは在る。`update(t)` で惑星が動く（既存）。
- `LocalGroup`: 構築後に軌道円 `THREE.Line` が group 配下に在る。`update(0)` と `update(t>0)` で `milkyWay.object.rotation.y` が変化する。`galacticCenterWorldPos()` が天の川中心（≈ -SUN_DISK_OFFSET 方向）を返す（原点でない）。
- Playwright E2E: 受入基準 1〜4。自転速度・軌道円の見た目・ラベル位置は live-tune。
