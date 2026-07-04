# stellar-voyage M2a｜恒星系突入と惑星 設計書

作成日: 2026-07-05
状態: ユーザー承認済み（実装計画作成前）
前提: M1（星野 + 飛行 + ワープ + 星選択 + 情報パネル）完成済み

## 概要

M1 で選択できる実在星に「突入」し、AU 単位のローカル座標系でその恒星系の惑星群を
3D 表示する。惑星に接近して型別 GLSL シェーダーによるクローズアップを見られる。
NASA 系外惑星データがある星は本物の惑星（実在バッジ）、無い星は決定論シードで
手続き生成する。M1 のハイブリッド方針（実データ + 手続き生成）を惑星系へ拡張する。

## 決定事項（ヒアリング結果）

| 項目 | 決定 |
|---|---|
| 突入方式 | 星を選択 → InfoPanel の「この星系へ」ボタン → SystemScene（AU 単位）へ切替 |
| 惑星データ | 実在（NASA Exoplanet Archive）+ 手続き生成のハイブリッド |
| 惑星描画 | 型別 GLSL 中系（ガス縞 / 岩石クレーター / 海洋 / 氷 + 大気フレネルリム） |
| 系内移動 | 自由飛行（M1 操作流用）+ 軌道リング表示、惑星クリックで選択・接近 |
| 公転 | アニメなし。シード由来の固定位相で静止配置（軌道リングは表示） |
| 着陸 | スコープ外（M1 同様） |

## 1. アーキテクチャ（M1 への追加）

新規モジュール（M1 の既存モジュールは変更最小、mode 分岐で共存）:

```
src/
  system/
    types.ts            # Planet, StellarSystem 型
    planetGen.ts        # スペクトル型別統計で惑星系を決定論生成
    habitableZone.ts    # 恒星光度からハビタブルゾーン境界（AU）
    StellarSystem.ts    # 実在データ優先 + 生成フォールバックで系を構築
    SystemScene.ts      # AU 座標系の Three.js シーン（恒星+惑星+軌道リング）
  planets/
    PlanetMaterial.ts   # 型別 ShaderMaterial ファクトリ
    planet.vert.glsl
    planet.frag.glsl    # 型別分岐 + 大気フレネルリム + 恒星方向ライティング
  catalog/
    exoplanets.ts       # ビルド生成物のローダ（星 index → 惑星配列）
  ui/
    PlanetPanel.ts      # 惑星情報パネル（日本語）
    SystemHud.ts        # 系内 HUD（恒星名・選択惑星）
  app.ts (変更)         # AppMode = 'galaxy' | 'system' の状態遷移を追加
scripts/
  build-exoplanets.ts   # NASA データを HYG 星に結合しバイナリ/JSON 生成
```

M1 の `app.ts` メインループを `mode` 分岐に拡張する。galaxy mode は M1 の描画・入力を
そのまま実行。system mode は SystemScene を描画し系内入力を処理する。app.ts が肥大化する
場合は `GalaxyMode.ts` / `SystemMode.ts` に分離する（実装計画で判断）。

## 2. データ

### 2.1 NASA Exoplanet Archive 結合（ビルド時）

- `scripts/build-exoplanets.ts` が NASA Exoplanet Archive の確認済み惑星テーブルを
  TAP（`https://exoplanetarchive.ipac.caltech.edu/TAP`）で取得。ライセンスは自由利用可、
  出典を About/README に記載。
- 取得列: `hostname`, `pl_name`, `pl_orbsmax`(軌道長半径 AU), `pl_rade`(半径, 地球半径),
  `pl_bmasse`(質量, 地球質量), `pl_eqt`(平衡温度) 等 + ホスト星の HD/HIP 別名。
- HYG 星との突合キー: HYG の `hd` / `hip` / `gl` 列と NASA のホスト星別名（HD/HIP/GJ）。
  ID 一致を優先し、無ければ固有名（proper）一致。マッチした HYG **出力 index**（M1 の
  カタログ index）をキーに惑星配列を格納。
- 生成物: `public/data/exoplanets.json`（星 index → 惑星配列）。件数は数千系程度で軽量。
- 欠損値（質量や半径が未観測）は型推定で補完し、`estimated: true` を立てる。

### 2.2 手続き生成（実データが無い星）

- シード = 星のカタログ index（M1 と同じ決定論性の前提）。同じ星に再突入すれば必ず同じ系。
- 惑星個数: スペクトル型・光度に依存した分布（M 型は少なめ等）。0〜8 個程度。
- 各惑星: 軌道長半径（対数分布）、型判定（下記）、半径・質量（型別レンジ）、
  ハビタブルゾーン内フラグ。
- 型判定: 恒星光度から求めた雪線・ハビタブルゾーンと軌道半径で
  岩石 / 海洋 / ガス / 氷 を決定（内側=岩石/海洋、外側=ガス/氷）。

### 2.3 ハビタブルゾーン

- `habitableZone(luminositySun): { inner: number; outer: number }`（AU）。
  簡易式 `inner = sqrt(L/1.1)`, `outer = sqrt(L/0.53)`（太陽で約 0.95〜1.37 AU）。
- 惑星の軌道長半径が [inner, outer] 内なら `inHabitableZone: true`。

## 3. 突入 / 退出

- `AppMode = 'galaxy' | 'system'`。
- 突入: galaxy mode で星選択中に InfoPanel の「この星系へ」ボタン →
  現在のカメラ世界位置と向きを退避 → `StellarSystem.build(catalog, index)` で系を構築 →
  SystemScene をロードし system mode へ。恒星は原点、惑星は軌道長半径×固定位相で配置。
- 退出: SystemHud の「系を出る」ボタン → galaxy mode へ復帰し退避した位置・向きを復元。
- 遷移は即時（フェード等の演出は任意・軽微）。

## 4. 惑星描画（型別 GLSL 中系）

- `PlanetMaterial(type, seed, starDir)` が型別 ShaderMaterial を返す。
- 共通頂点シェーダー + 型分岐フラグメントシェーダー:
  - ガス: 緯度方向の帯状ノイズ縞（FBM）、2〜3 色帯。
  - 岩石: クレーター風 FBM + 起伏の陰影（ノーマル摂動）。
  - 海洋: 青基調 + 大陸ノイズ + 白い雲レイヤ。
  - 氷: 白基調 + 亀裂ノイズ。
- 全型に薄い大気フレネルリム（外周が明るく光る）。恒星方向 `starDir` でライティング
  （昼夜境界）。seed で模様を変え、同一惑星は毎回同じ見た目。
- 恒星は発光スフィア + ハロー（ビルボード or フレネル）。
- 惑星接近でクローズアップ（着陸なし）。距離に応じた素朴な LOD（遠→点、近→球）。

## 5. 系内 UI

- 自由飛行（M1 の ShipController/InputController を AU スケールで流用。速度域は
  km/s〜数 AU/s 程度に調整、ワープ域は系内では不要 or 低倍率）。
- 軌道リング（各惑星の軌道長半径の円 or 楕円、薄い線）。
- 惑星クリック（M1 の Picker を系内天体に適用）で PlanetPanel:
  型・軌道長半径(AU)・半径(地球比)・質量(地球比)・平衡温度・ハビタブルゾーン内フラグ・
  実在/生成バッジ。日本語。
- SystemHud: 恒星名（実在なら固有名/HYG 番号）・選択惑星名・「系を出る」ボタン。

## 6. エラー処理

- NASA データ読込失敗: 手続き生成のみにフォールバック（系は必ず表示される）。
- 実在惑星の軌道長半径欠損: 型と恒星から推定配置し `estimated` バッジ。
- 惑星 0 個の系（恒星のみ）: 「確認された惑星なし」表示で恒星だけ表示。

## 7. テスト方針

- vitest 単体テスト:
  - 手続き生成の決定論性（同 index → 同一の惑星系: 個数・型・軌道）
  - NASA 結合パイプライン（HD/HIP/GJ ID 突合の正しさ、index キーの整合）
  - ハビタブルゾーン境界（太陽で約 0.95〜1.37 AU）
  - 惑星型判定（軌道半径 × 光度 → 型）
  - 軌道長半径 + 位相 → 3D 座標変換
- 描画（惑星シェーダー・恒星・軌道リング・遷移）は Playwright 目視で実機確認。

## 8. M2a 内マイルストーン

1. **突入体験の成立**: 突入/退出遷移 + AppMode 分岐 + 恒星スフィア + 手続き惑星の
   球体配置 + 軌道リング + 系内自由飛行。この時点で「星に入って惑星を回れる」。
2. **惑星クローズアップ**: 型別惑星シェーダー + 大気リム + 恒星ライティング +
   クローズアップ LOD + PlanetPanel。
3. **実在惑星結合**: build-exoplanets で NASA データ結合 + 実在バッジ + About/README 出典。

## 9. スコープ外（後続マイルストーン）

- 惑星地表への着陸・地形飛行
- 公転アニメーション（惑星の軌道運動）
- 衛星（月）・惑星リング（土星型）の作り込み
- M2b（手続き銀河生成・他銀河ハイパージャンプ）
- 相対論演出（M3）

## 10. ライセンス・クレジット

- NASA Exoplanet Archive: 自由利用可、出典を About/README に記載。
- HYG Database（M1 から継続）: CC BY-SA 4.0 のクレジットを維持。
