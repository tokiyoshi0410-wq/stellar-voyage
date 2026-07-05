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

## いま作業中 — 「連続ズーム航法 UX」ミルストーン

**目的（user 依頼）**: 現行の「galaxy/system 2 モード + ボタン切替」が使いにくいので作り替える。
- **太陽系を斜め上から見下ろす宇宙船視点で開始**（本物の 8 惑星）
- **マウスドラッグ=視点周回 / ホイール=ズーム / WASD=移動 / 画面下の速度スライダー**で直感操作
- **ズームアウトで太陽が銀河の一星になり他星系へ連続遷移**（クロスフェードで継ぎ目を隠す）

- **設計書(spec)**: `docs/superpowers/specs/2026-07-05-stellar-voyage-navigation-ux-design.md`
- **実装計画(plan)**: `docs/superpowers/plans/2026-07-05-stellar-voyage-navigation-ux.md`（全 10 タスク）

### 進捗（このセッション終了時点）

| Task | 内容 | 状態 |
|---|---|---|
| Nav-1 | 太陽系 8 惑星データ + Planet.hasRing | ✅ 完了・レビュー通過（`a3b789f`）|
| Nav-2 | buildStellarSystem index 0→太陽系 | ✅ 完了・レビュー通過（`1962147`）|
| Nav-3 | orbitCameraPosition（周回カメラ計算） | ✅ 完了・レビュー通過（`6090c6a`）|
| Nav-4 | fade.ts + speed.ts（フェード曲線+速度写像） | **⏳ 次はここ。brief 生成済み・未派遣** |
| Nav-5 | NavigationController（状態機械） | 未着手 |
| Nav-6 | InputMapper（ドラッグ/ホイール/WASD） | 未着手 |
| Nav-7 | SpeedSlider + ControlHints（DOM） | 未着手 |
| Nav-8 | StarField フォーカス相対描画 + 土星の環 | 未着手（描画→要 Playwright 検証）|
| Nav-9 | app.ts 再構築 前半（単一シーン+周回カメラ+入力+フェード） | 未着手（描画→要 Playwright）|
| Nav-10 | app.ts 再構築 後半（フォーカス切替+クリック選択） | 未着手（描画→要 Playwright）|

**現 HEAD: `6090c6a`。Nav-4 の BASE も `6090c6a`。**
Nav-4 の brief は `.superpowers/sdd/task-4-brief.md` に生成済み（まだ実装者を派遣していない）。

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

user が「宇宙旅行続き」「stellar-voyage 続き」「航法 UX 続き」等と言ったらこのファイルを最初に読む。
