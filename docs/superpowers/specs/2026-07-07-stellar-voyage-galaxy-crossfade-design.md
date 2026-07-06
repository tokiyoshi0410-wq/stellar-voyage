# 天の川 → アンドロメダ ズームクロスフェード 設計

日付: 2026-07-07
ステータス: 設計承認済み（user 承認 2026-07-07）

## 目的

最もズームアウトした「局部銀河群」段で、天の川銀河とアンドロメダ銀河を**横に並べて同時表示**していたのを、
**ズームアウトに連れて 天の川 → アンドロメダ へクロスフェードで切り替わる**演出に変える。

- 現状の問題（user 報告 2026-07-07）: 2つの渦巻き銀河が横並びで、両方が似た見た目・一方が無ラベルのため
  「アンドロメダが二つ並んでいる（重複）」に見える。実際は左=天の川（現在地）・右=アンドロメダだが伝わらない。
- 狙い（user 選択肢 A）: **常に画面中央は1つの銀河**。天の川を見ている状態からズームアウトすると
  天の川がフェードアウトし、入れ替わりにアンドロメダがフェードインする。「我々の銀河 → 約250万光年かなた →
  アンドロメダ」という連続ズーム航法らしい旅の演出。

## 現状（実装済みの土台）

- `src/galaxy/LocalGroup.ts`: 天の川ディスク（`MILKY_WAY` seed1・原点から `-SUN_DISK_OFFSET` オフセット）＋
  アンドロメダディスク（`ANDROMEDA` seed2・原点から `+ANDROMEDA_OFFSET_AU - SUN_DISK_OFFSET` の**横オフセット**）＋
  現在地マーカー（原点）＋太陽公転軌道円（金色）を `object`(Group) に格納。`setOpacity(o)` で全要素を一律 fade。
- `src/nav/localGroupFade.ts`: `localGroupFade(v)` = smoothstep(`LOCALGROUP_FADE_START_AU`=3e9 → `LOCALGROUP_FADE_END_AU`=1e10)。
- `src/app.ts`: `lgFade = localGroupFade(viewDistanceAu)`。`field.setOpacity(1 - lgFade)`（近傍星野）、
  `localGroup.setOpacity(lgFade)`、`localGroup.object.visible = lgFade > 0`、`localGroup.setPosition(-focusWorldAu…)`。
  `lgFade > 0.5` のとき局部銀河群ラベル（現在地/太陽の銀河公転/約250万光年）を表示。
- `src/galaxy/galaxyParams.ts`: `MILKY_WAY.radiusAu`=4e9、`ANDROMEDA.radiusAu`=8e9、`ANDROMEDA_OFFSET_AU`=2.4e10。
- `SUN_DISK_OFFSET` = `MILKY_WAY.radiusAu * 0.55` ≈ 2.2e9。
- `src/nav/NavigationController.ts`: `MAX_VIEW_AU`=5e10（最大ズームアウト）、`MIN_VIEW_AU`=0.05。

→ ズーム帯 **[1e10, 5e10]**（localGroupFade 完了後〜最大）にクロスフェードを入れる余地が十分ある。

## 設計

### 1. アンドロメダを原点中心へ移動

- `LocalGroup` コンストラクタで、アンドロメダの位置を `(ANDROMEDA_OFFSET_AU - SUN_DISK_OFFSET, 0, 0)` から
  **`(0, 0, 0)`（原点中心）** に変更。傾き（`rotation.x=0.7, rotation.z=0.3`）は天の川と差別化するため維持。
- 天の川は従来どおり `(-SUN_DISK_OFFSET, 0, 0)`（我々は天の川の腕の中にいる＝中心が原点からズレる表現）を維持。
- 意図: 我々はアンドロメダを**外から眺める**ので銀河中心を画面中央（＝フォーカス点＝原点）に置く。天の川は
  内側から見る扱いで従来のオフセット。2つが横に並ぶことはなくなり、常に画面中央は1つの銀河。
- 「約250万光年」は空間的なオフセットではなく**遷移ラベル**で表現する（下記 3）。`ANDROMEDA_OFFSET_AU` は
  本設計では未使用になる（定数は残置可・参照は LocalGroup から除去）。

### 2. ズームアウトの流れと不透明度合成

| ズーム帯 (viewDistanceAu) | 見え方 |
|---|---|
| 〜3e9 | 銀河ステージ（近傍星野＝天の川の内側） |
| 3e9 → 1e10 | 近傍星野フェードアウト → 天の川ディスクフェードイン（既存 `localGroupFade`） |
| 1e10 → `ANDROMEDA_FADE_START_AU`(=2e10) | 天の川ディスク＋現在地マーカー＋公転円（外から見た我々の銀河） |
| `ANDROMEDA_FADE_START_AU`(2e10) → `ANDROMEDA_FADE_END_AU`(3.5e10) | **天の川フェードアウト → アンドロメダフェードイン（新規クロスフェード）** |
| 3.5e10 → 5e10(最大) | アンドロメダのみ |

- **新規純粋関数** `andromedaFade(viewDistanceAu): number`（`src/nav/localGroupFade.ts` に追加）:
  smoothstep(`ANDROMEDA_FADE_START_AU` → `ANDROMEDA_FADE_END_AU`)、範囲 [0,1]、単調増加。
- **不透明度合成**（app.ts が毎フレーム算出し LocalGroup に渡す）:
  - `andFade = andromedaFade(v)`
  - 天の川グループ（ディスク＋現在地マーカー＋公転円）不透明度 = `lgFade * (1 - andFade)`
  - アンドロメダ不透明度 = `lgFade * andFade`
  - 近傍星野 = `1 - lgFade`（既存・不変）
- `LocalGroup.setOpacity(o)` を **`setOpacities(milkyWay: number, andromeda: number)`** に置換。
  天の川ディスク・現在地マーカー・公転円は `milkyWay`、アンドロメダディスクは `andromeda` を設定。
- `localGroup.object.visible` は `lgFade > 0`（従来どおり。両不透明度が 0 なら描画されない）。
- しきい値（2e10 / 3.5e10）は live-tune 値。

### 3. ラベルの遷移（app.ts）

`lgFade > 0.5` のブロックで、`andFade` に応じてラベルを出し分ける（worldPos は該当銀河中心）:

- `andFade < 0.35`（天の川が主役）:
  - 「天の川銀河（現在地）」（現在地マーカー位置）
  - 「太陽の銀河公転 ・ 約2.3億年で1周（半径約2.6万光年）」（天の川中心）
- `0.35 ≤ andFade ≤ 0.65`（クロスフェード中）:
  - 「← 約250万光年 → アンドロメダ銀河へ」（画面中央付近＝原点）
- `andFade > 0.65`（アンドロメダが主役）:
  - 「アンドロメダ銀河（M31）・天の川から約250万光年」（アンドロメダ中心＝原点）

- しきい値 0.35 / 0.65 は live-tune。既存の3ラベル（現在地/太陽の銀河公転/約250万光年 の縦分離 dyPx）は
  天の川主役帯でのみ使用。`LocalGroup` の `galacticCenterWorldPos()`（天の川中心）は維持、`midpointWorldPos()` は
  アンドロメダ原点化で天の川中心とアンドロメダ中心の中点＝ほぼ原点になる（遷移ラベルは原点付近で可・維持 or
  単純に原点を使う）。

### 4. スコープ外（今回やらない）

- アンドロメダ**内部に入る/手続き生成星野**（deferred Phase 2 のまま）。今回は「眺めがクロスフェードで
  切り替わる」演出まで。ズームで戻れば アンドロメダ → 天の川 → 近傍星野 へ逆再生（`viewDistanceAu` 基準なので自動）。
- 左上 `ScalePanel`「【局部銀河群】…」の文言は現状維持（局部銀河群の文脈として両帯で共通）。
- 天の川・アンドロメダを画面基準の一定サイズにする（ズームで縮まない）スケーリングは**初期実装では入れない**。
  下記「既知のトレードオフ」を実機で見て違和感が強ければ follow-up で検討。

### 5. 既知のトレードオフ

- アンドロメダは原点固定・実サイズ（天の川の 2倍径 8e9）なので、フェードイン開始（2e10）時は大きめに見え、
  ズームアウトに連れてやや小さくなる。強い違和感があれば follow-up で「画面基準の一定サイズ化」または
  フェード帯・サイズの調整（live-tune）で対応。

## 実装ゾーン分離（このプロジェクトの方針）

- **純粋ロジック（TDD 厳密, RED→GREEN）**: `andromedaFade(viewDistanceAu)` の境界・単調性・範囲。
  合成不透明度の不変条件（後述）。
- **見た目（テストで assert しない・Playwright 実機調整）**: アンドロメダの配置(原点)・傾き・サイズ、
  フェード帯しきい値（2e10/3.5e10）、ラベルしきい値（0.35/0.65）、ラベル文言の見え方。

### TDD 対象の不変条件（値ではなく構造）

- `andromedaFade`: `andromedaFade(START 以下)===0` / `andromedaFade(END 以上)===1` / 単調増加 / 範囲[0,1]。
- 合成: `milkyWayOpacity = lgFade*(1-andFade)`、`andromedaOpacity = lgFade*andFade` を算出する純粋関数
  （例 `localGroupOpacities(viewDistanceAu): {milkyWay, andromeda}`）を切り出し、
  「最大ズーム(5e10)で milkyWay≈0 かつ andromeda≈1」「localgroup 帯以前(<3e9)で両方 0」
  「天の川主役帯(1e10〜2e10)で milkyWay≈1 かつ andromeda≈0」を検証（しきい値そのものは非 assert、
  代表点の大小関係で確認）。

## テスト・検証

- `npx tsc --noEmit` / `npm test`（新規 `andromedaFade`・合成の構造テスト含む）/ `npm run build`。
- Playwright E2E（コントローラ実機・`:5182`）:
  1. ズームアウトで 近傍星野 → 天の川ディスク（現在地マーカー/公転円/「天の川銀河」ラベル）を確認。
  2. さらにズームアウトで 天の川がフェードアウト → アンドロメダがフェードインし、**横並びが解消**され
     常に中央は1つの銀河であることをスクショで確認（クロスフェード中の中間帯・アンドロメダ主役帯）。
  3. ラベルが 天の川 →「約250万光年」→ アンドロメダ と遷移。
  4. ズームで戻すと アンドロメダ → 天の川 → 近傍星野 へ逆再生（現在地マーカー復帰）。
  5. 無回帰: 近傍星野クロスフェード・スケールバー非表示（localgroup 段）・クリック非干渉・惑星公転・
     光速パルス・console は favicon404 のみ。

## Self-Review（記入）

- **Spec coverage**: 目的（横並び解消＝クロスフェード）を配置変更(§1)＋不透明度合成(§2)＋ラベル遷移(§3)で網羅。
  スコープ外(§4)で「アンドロメダ内部侵入」を明示除外。
- **Placeholder scan**: なし（全節に具体値・関数名・帯）。
- **Ambiguity check**: 「クロスフェード」= soft crossfade（中間帯で両者が短時間ブレンドするのは許容、常に
  中央は概ね1つ）。「一定サイズ化」は初期実装では**入れない**と明記（§4）。
- **Type consistency**: `andromedaFade(viewDistanceAu:number):number`、`LocalGroup.setOpacities(milkyWay,andromeda)`、
  合成関数 `{milkyWay,andromeda}` が app.ts の呼び出しと一致。
