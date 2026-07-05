# stellar-voyage セッション引き継ぎ

> **次セッションはまずこのファイルを読むこと。** 詳細な進捗の一次ソースは
> `.superpowers/sdd/progress.md`（SDD ledger）。矛盾したら ledger と `git log` を信じる。

## これは何

ブラウザで動く**宇宙旅行シミュレーションゲーム**（Vite + TypeScript + Three.js、Cloudflare Pages 公開想定、未デプロイ）。
実在の星カタログ（HYG）と NASA 系外惑星データ + 手続き生成で、光速〜超光速で星々と惑星系を探検する。
場所: `C:\Users\yusuke\stellar-voyage`。git repo、ブランチ `main`、リモート未設定（未プッシュ）。

## 完成済み（すべて `main` にコミット済み・Playwright 実機検証済み）

- **M1 — 星空と飛行**: 実在 HYG カタログ 25,792 星を色付き点描画、対数スロットルで 0〜0.999c
  〜ワープ、星クリックで日本語情報パネル。floating origin + 対数深度。
- **M2a — 恒星系突入と惑星**: 星を選び「この星系へ」で AU スケールの系ビューへ、恒星+惑星+軌道リング、
  型別 GLSL 惑星シェーダー（昼夜境界+大気リム）、NASA 実在系外惑星 310 系統結合（実在バッジ）、
  ハビタブルゾーン判定。惑星クリックで日本語 PlanetPanel。

## 直近完了 — 「縮尺バー + 局部銀河群（アンドロメダ）」ミルストーン ✅ 完了（2026-07-05）

画面上の距離表示と、天の川銀河のさらに外＝アンドロメダ銀河との位置関係を追加。
- **縮尺バー（左下・常時）**: カメラ投影から算出し、ズームで単位が **AU（+億km+光での時間）→ 光年 → 万光年** と自動切替（`src/edu/scaleBar.ts` の `scaleBarFor`、`src/ui/ScaleBar.ts`）
- **局部銀河群段**: `viewDistanceAu >= 1e10` で新スケール段 `localgroup` → 中央に模式図（天の川銀河 ⊕現在地(太陽系) ─約250万光年─ アンドロメダ銀河 M31、`src/ui/LocalGroupDiagram.ts`）。実データの銀河は無いので**概念図**
- 星名ラベルは galaxy に加え localgroup でも省略（`app.ts` の分岐）

- spec: `docs/superpowers/specs/2026-07-05-stellar-voyage-scalebar-localgroup-design.md`
- plan: `docs/superpowers/plans/2026-07-05-stellar-voyage-scalebar-localgroup.md`（全 5 タスク）

**現 HEAD: `63c40dc`。範囲 `5d88c27..63c40dc` = 5 タスク + 億km 表記 fix。すべて `main`・未 push。**
opus 最終レビュー「Ready to merge with fixes」→ 唯一の指摘（縮尺バーの億km が niceAu≥100 で指数表記 "1.5e+2億km" になる）を修正済み・再 E2E 確認（"750億km"）。144/144・tsc・build 緑。Playwright E2E で3段（太陽系→銀河→局部銀河群）の縮尺バー単位切替・模式図出現・ラベル省略・クリック非干渉を検証。

## 以前の完了 — 「教育スケールパネル（光速で測る規模）」ミルストーン ✅ 完了（2026-07-05）

ズームアウトで太陽系→太陽系の外→天の川銀河へスケールが変わるのに合わせ、左上パネルに小学生向けの教育情報を表示。
- **太陽系**: 端から端 約90億km（海王星の軌道）／光でも約8時間／地球から太陽まで光で8分19秒
- **太陽系の外へ**: 太陽系はこんなに小さい！／いちばん近い星まで光で約4.2年／光は1秒で地球7周半
- **天の川銀河**: 星の数 約2000億個／端から端 約10万光年／太陽もこの中のひとつ（**この段階では星名ラベルを省略**、星の点は残る）
- 光速換算は `src/edu/scaleInfo.ts`（`1 AU = 8.317 光分`、`scaleInfoFor(viewDistanceAu)` が3ステージ判定）、パネルは `src/ui/ScalePanel.ts`（左上・`pointer-events:none`）
- ステージ境界: solar<30000 AU / interstellar 30000–1e6 / galaxy>=1e6（`viewDistanceAu`）

- spec: `docs/superpowers/specs/2026-07-05-stellar-voyage-educational-scale-design.md`
- plan: `docs/superpowers/plans/2026-07-05-stellar-voyage-educational-scale.md`（全 3 タスク）

**現 HEAD: `bea916f`。範囲 `5b64c85..bea916f` = Scale 3 タスク + formatLightTime 桁上がり fix。すべて `main`・未 push。**
opus 最終レビュー「Ready to merge」（修正不要）。133/133 テスト・tsc・build 緑。Playwright E2E 検証済み（3ステージのパネル文言・銀河でのラベル省略 9→5→0・クリック非干渉）。

## 前の完了 — 「星ラベル・距離表示・軌道視認性」ミルストーン ✅ 完了（2026-07-05）

連続ズーム航法に、星名ラベル・惑星距離ラベル・軌道視認性を追加。
- **銀河ビュー**: カメラに近い星に名前ラベル（固有名 or `HYG #番号`）＋太陽からの距離（光年）
- **星系ビュー**: 各惑星に「名前＋軌道半径（AU＋億km）」ラベル（地球=1.0 AU ≈ 1.5億km）＋中央星名
- **軌道リング**: 明るく・惑星ごとの色で視認性向上
- **太陽表示**: HYG index 0 を全箇所で「太陽」表示（`ui/format.ts` の `starDisplayName` ヘルパー、旧 "Sol" 廃止）
- ラベルは DOM オーバーレイ（`ui/LabelLayer.ts`）＋`camera.project()`（float64）、`pointer-events:none` でクリック非干渉

- spec: `docs/superpowers/specs/2026-07-05-stellar-voyage-labels-and-distances-design.md`
- plan: `docs/superpowers/plans/2026-07-05-stellar-voyage-labels-and-distances.md`（全 5 タスク）
- ledger: `.superpowers/sdd/progress.md`（「Labels & Distances」節）

**現 HEAD: `9d81d44`。範囲 `6e6ccba..9d81d44` = Labels 5 タスク + 太陽 fix + ラベル1フレーム遅延 fix。すべて `main`・未 push。**
opus 最終レビュー通過。124/124 テスト・tsc・build 緑。Playwright E2E 検証済み。最終レビューが捕捉した「motion 中ラベルが1フレーム遅れる」問題（`labels.render` を `engine.render` 前に呼んでいた→後へ移動）を修正済み。
未対応（deferred, cosmetic）: 近接連星のラベル重なり、惑星ラベルと右上パネルの重なり。

## その前に完了 — 「連続ズーム航法 UX」ミルストーン ✅ 完了（2026-07-05）

現行の「galaxy/system 2 モード + ボタン切替」を、単一の連続ズーム航法へ作り替え完了。
- **太陽系を斜め上から見下ろす視点で開始**（本物の 8 惑星・実質量）
- **ドラッグ=視点周回 / ホイール=ズーム / WASD=移動 / 画面下の速度スライダー**
- **ズームアウトで太陽系がフェードし銀河星野へ連続遷移**、別の星に近づくとその星系へフォーカス切替
- **クリックで星/惑星を選択**（ピクセル単位レイキャスト）→ 日本語情報パネル

- spec: `docs/superpowers/specs/2026-07-05-stellar-voyage-navigation-ux-design.md`
- plan: `docs/superpowers/plans/2026-07-05-stellar-voyage-navigation-ux.md`（全 10 タスク）
- SDD ledger 全詳細: `.superpowers/sdd/progress.md`（「Navigation UX」節）

**現 HEAD: `b382e6b`。範囲 `bc0926b..b382e6b` = Nav-1〜10 + WASD fix + 最終レビュー修正 + cosmetic。すべて `main`・未 push（remote 未設定）。**

全10タスク完了・全 per-task レビュー通過・opus 全ブランチ最終レビュー通過。113/113 テスト・tsc クリーン・build 成功。
コントローラが Playwright 実機 E2E で全受入基準を確認済み（太陽系見下ろし起動 / ドラッグ周回 / ホイールズーム / WASD 移動 / 銀河フェード遷移 / フォーカス切替 Sol→他星 / クリック選択）。

**最終レビュー + E2E で捕捉し修正済みの主なバグ:**
- WASD がキャンバス（フォーカス不可）にキーバインドされ実ユーザーに効かず → InputMapper のキーボードを window へ
- 星野シェーダが camAu を二重減算（viewMatrix と重複）→ シェーダの `- uCameraAu` 除去（数学的に確実、視覚的定量分離は view 回転に埋もれ不可）
- クリックが中央固定レイ → ピクセル単位 Raycaster へ（user 承認）
- 太陽系の質量が密度近似で誤り（地球 0.7 倍表示）→ 実質量ハードコード

### 未対応（次セッション/follow-up、いずれも merge ブロッカーではない）
1. 孤立した dead module 削除（ShipController/InputController/HUD/SystemHud/FloatingOrigin + 旧 InfoPanel「この星系へ」経路。tree-shake 済みで安全）
2. **実在系外惑星の星**を新フローで E2E 確認（コード経路は不変・低リスクだが未クリック）
3. `stellarSystem.test` のテスト名が古い（index 0 は現在太陽系）→ 改名 + 手続き生成経路の assertion 追加
4. 惑星シェーダに opacity uniform が無くフェードせずポップ（fade 帯ではサブピクセルで無視可）
5. `starRelative.ts` は未使用 + I-A 修正でシェーダと式が不一致 → 削除
6. `DENSITY` が planetGen.ts と重複
7. 次ミルストーン: scene/mode マネージャ抽出、catalog↔exoplanets の index 整合保証

## 再開手順（SDD ループ）

実装は **superpowers:subagent-driven-development** スキルの方式で進めている。1 タスクずつ:

1. **brief 生成**（未生成なら）:
   `"<SDD_SCRIPTS>/task-brief" docs/superpowers/plans/2026-07-05-stellar-voyage-navigation-ux.md <N>`
2. **実装者を派遣**: `Agent(subagent_type: general-purpose, model: sonnet)` に brief パス + Global Constraints
   + 「その task の Interfaces」+ report ファイルパスを渡す。純粋モジュールは完全コード転記 TDD。
3. **レビューパッケージ生成**: `"<SDD_SCRIPTS>/review-package" <BASE> <HEAD>`（BASE = その task 着手前の HEAD）。
4. **レビュー派遣**: `Agent(general-purpose, sonnet)` に brief + report + diff ファイルパス + Global Constraints。
5. **Important/Critical あれば修正サブエージェント**→ 再レビュー。無ければ完了。
6. **ledger に 1 行追記** + todo 更新して次タスクへ。
7. **描画タスク(8,9,10)の後はコントローラ(自分)が Playwright で実機 E2E 検証**（下記）。
8. **全タスク後、最上位モデル(opus/fable)で全ブランチ最終レビュー** → 修正 → 完了。

`<SDD_SCRIPTS>` = `C:\Users\yusuke\.claude\plugins\cache\claude-plugins-official\superpowers\6.1.1\skills\subagent-driven-development\scripts`

## 重要な運用ルール（このプロジェクト固有）

- **コミット**: `git -c commit.gpgsign=false commit`（署名鍵なし）。メッセージ末尾に
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`。`--no-verify` 禁止。git identity はローカル設定済み。
- **ビルド系コマンド**（`npm run build` / `build:catalog` / `build:exoplanets`）は監査 hook が発火する。
  変更が test 済み・隔離済みなら末尾に `# CLAUDE_AUDIT_OK` を付けて再実行してよい。
- **データファイルは gitignore 済みの生成物**（`data/hygdata_v3.csv`, `data/nasa-exoplanets.csv`,
  `public/data/hyg.bin`, `hyg-names.json`, `exoplanets.json`）。**すでにディスク上に生成済み**なので
  `npm run dev` はそのまま動く。再生成が要れば `npm run build:catalog` / `build:exoplanets`。
- **テスト**: `npm test`（vitest、現在 93 passing）。型: `npx tsc --noEmit`。
- **dev サーバー**: `npm run dev` → `http://localhost:5180`。

## Playwright E2E 検証のコツ（描画タスク後）

- Playwright MCP でブラウザ操作。`browser_navigate` → `browser_evaluate` で canvas に
  PointerEvent/KeyboardEvent/WheelEvent を dispatch → `browser_take_screenshot` → `Read` で目視。
- **特定の星に照準を合わせる**: `public/data/hyg.bin` を node でデコードして星の xyz(pc) を取得し、
  `yaw = atan2(-dx, -dz)`, `pitch = asin(dy)` を計算 → pointermove で aim（新 UX ではドラッグ相当）。
  実例スクリプトは `<scratchpad>/find_star.mjs` / `find_hz.mjs`（このセッションの scratchpad）。
- fixed 要素の可視判定は `getComputedStyle(el).display`（`offsetParent` は fixed で null になる罠）。
- 実在惑星が出る星（例: HYG #22786=HD 199509, #1505=HD 10180[HZ 内 g あり]）で実在バッジを確認できる。

## 最終レビューで片付ける宿題（deferred minors）

- **太陽系の質量が密度近似で不正確**（地球 0.7 倍表示等）。user は「本物の太陽系」希望なので、
  `solarSystem.ts` に実質量(地球比)をハードコードする改善を検討。
- `stellarSystem.test.ts` の一部テスト名が「procedural」のまま index 0（現在は太陽系）で走る — 名称修正。
- `DENSITY` が `solarSystem.ts` と `planetGen.ts` で重複 — 共有化。
- 旧 `ShipController`（throttle+warp）・InfoPanel の突入ボタン等が Nav app 再構築後に未参照になる —
  整理判断。
- app.ts の mode/scene 管理が着陸・M2b で破綻しうる — scene マネージャ抽出（次ミルストーン設計時）。
- カタログ index と exoplanets.json の整合を保証する仕組みがない（両方 1 コマンド生成 or ハッシュ照合）。

## 合言葉

user が「宇宙旅行シミュレーション」「宇宙旅行続き」「stellar-voyage 続き」「航法 UX 続き」等と言ったらこのファイルを最初に読む。
