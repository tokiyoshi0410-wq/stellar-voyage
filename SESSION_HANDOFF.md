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

## 直近完了 — 「太陽の銀河公転（実スケール・銀河ビュー）」ミルストーン ✅ 完了（2026-07-06）

太陽の銀河公転を実スケールで表現。太陽系ビューに描いていた模式的な銀河公転円（実際は約5,500万倍で惑星と同画面に描けない）は撤去し、**銀河（天の川）ビュー**で実比率の公転軌道円＋天の川の自転として見せる。
- **太陽系ビュー（撤去）**: `SystemScene` の金色公転円・道標・系トラベル(`setTravelAngle`)を削除、`src/system/galacticPath.ts`(+test) 削除。太陽は中心静止。惑星の公転アニメ（前ミルストーン）＋停止ボタン（`PauseButton`＋Space・`if(!paused)animT+=dt`、sun-motion-pause 由来・維持）は継続。太陽ラベル「太陽 ・ 公転 220km/s（クリックで詳細）」。`travelGroup` は原点固定で残置し `planetWorldPos`/`sunWorldPos` の world 位置ベースのラベル/クリックは不変。
- **銀河ビュー（追加）** `src/galaxy/LocalGroup.ts`: 太陽公転軌道円（`THREE.Line` フル円・半径 `SUN_DISK_OFFSET`=天の川半径×0.55≈実際の太陽位置52%と一致・銀河中心中心・円盤面内 `rotation.x=0.5`→太陽=現在地マーカーが a=0 で円上）。`update(t)` で天の川を面内自転（`rotation.y=GALAXY_SPIN_SPEED*t`・**Euler order は既定 'XYZ'＝Rx·Ry=傾いた法線周り。'YXZ' は歳差でぐらつくので不可**＝d3bdd9b で訂正）。`galacticCenterWorldPos()`。`app.ts` が毎フレーム `localGroup.update(animT)`（停止ボタンで自転も凍結）＋ラベル「太陽の銀河公転 ・ 約2.3億年で1周（半径約2.6万光年）」を局部銀河群段に追加。
- spec: `docs/superpowers/specs/2026-07-06-stellar-voyage-galactic-orbit-realscale-design.md` / plan: `docs/superpowers/plans/2026-07-06-stellar-voyage-galactic-orbit-realscale.md`（全3タスク）

**現 HEAD: `216a81b`。範囲 `2fe0dc1..216a81b` = 3タスク（4b476b9 Part A 撤去 / 26dc8cc LocalGroup 軌道円+自転 / d3bdd9b YXZ→既定XYZ 訂正 / 216a81b app 結線）。すべて `main`・未 push。**
opus 最終レビュー「Ready to merge — YES」（Critical/Important 0、Part A 撤去完全・Euler 修正が数学的に正しいと独立検証・軌道円幾何正確・pause 一貫）。183テスト・tsc・build 緑。Playwright E2E: 太陽系ビュー=金色円/道標無し・太陽静止・惑星公転動く・停止/クリック可。銀河ビュー(大ズームアウト)=天の川の周りに金色公転円・太陽が円上・天の川が面内自転(~17°/3s・ぐらつき無し)・「太陽の銀河公転」ラベル・アンドロメダ静止・既存局部銀河群不変。実装/レビュー=sonnet、最終=opus。
※経緯: 当初 solar view に 模式円→系トラベル→フル円→連続周回 と反復したが、user「よりリアルに実際の大きさで」を受け「実スケールは solar view に不可能(約5,500万倍)」と判明→ user が「銀河ビューで実スケール周回」を選択し pivot（solar view 円は全撤去、galacticPath も削除）。sun-motion-pause の PauseButton は維持。

## 以前の完了 — 「恒星系の公転アニメーション」ミルストーン ✅ 完了（2026-07-06）

全恒星系で惑星が軌道に沿って公転（時間で回る）。太陽（中心星）は中心に静止。内惑星ほど速い（ケプラー第三法則の相対速度）。惑星メッシュ・ラベル・クリック判定が同じ `animT` と純関数 `animatedPhase` で位置一致し、動く惑星に追従・選択できる。
- **純関数**（`src/system/orbit.ts`）: `orbitalAngularSpeed(a)=min(ANIM_K·a^-1.5, ANIM_MAX_OMEGA)`（ケプラー・上限クランプ）、`animatedPhase(starIndex,i,a,t)=planetPhase+ω·t`。時間スケール `ANIM_EARTH_PERIOD_SEC=12`（地球12秒/周・live-tune、テストで秒数は固定しない）。
- **`SystemScene.update(t)`**: 毎フレーム惑星メッシュ（＋土星の環 `ringMeshes` Map）を現在位置へ。中心星・軌道リング円・PointLight は静止。
- **`pickPlanet(...,t)`**（optional t=0＝従来静的挙動）と `app.ts` のラベルが同じ `animT` を使う（クリックが描画位置と一致）。`app.ts` は `animT += dt` を毎フレーム累積し `if(systemScene)` 内で `systemScene.update(animT)` を呼ぶ。`planetPhase` import は除去し `animatedPhase` に統一。
- 不変条件（`animatedPhase` にコメント記載）: mesh/label/pick は必ず同じ `(starIndex,i,a)` と同じ `animT` でこれを呼ぶ。
- spec: `docs/superpowers/specs/2026-07-06-stellar-voyage-orbit-animation-design.md`
- plan: `docs/superpowers/plans/2026-07-06-stellar-voyage-orbit-animation.md`（全4タスク + polish）

**現 HEAD: `d07b0ec`。範囲 `159fa15..d07b0ec` = 4タスク + polish(d07b0ec: 不変条件コメント/中心星static test/typo修正)。すべて `main`・未 push。**
opus 最終レビュー「Ready to merge — YES」（Critical/Important 0、5 named risk[単一時刻ソース一貫/TDZ無し(animTはclick時=init後読み)/無回帰(t=0=planetPhase・update は星/リング/光不変・procedural同様)/ケプラー+clamp(a=0はpow=Inf→π=有限でNaN無し)/hot-path無視可]すべて健全と検証)。180/180・tsc・build(493KB) 緑。Playwright E2E: 4秒で内惑星が移動(水星105/金星190/地球205/火星214px)・太陽は中心静止・ラベルが惑星に追従・地球の現在位置クリックで「地球（実在）」=動く惑星のクリック追従・軌道リング静止・太陽の軌道線表示。実装/レビュー=sonnet、最終=opus。
Deferred（非ブロッキング, progress.md 参照）: ring-follow の unit test（E2E 検証済・private map で awkward）、`planetPhase` を (starIndex,i) で memoize（8惑星で無視可）、`SystemScene.update` を fade>0 でゲート（現状 invisible でも呼ぶ・8メッシュで安価）。

## 以前の完了 — 「太陽系の詳細表示（公転/自転速度・地球距離・光速/新幹線）」ミルストーン ✅ 完了（2026-07-06）

太陽系ビュー（`starIndex 0` 限定）を教育的に詳しく。手続き生成の恒星系は現状維持（`isSolar` gate）。
- **常時ラベル**: 各軌道上に公転速度(km/s)、各惑星 near に自転赤道速度(km/h、金星/天王星は「(逆)」)、太陽 near に「太陽 ・ 公転 220km/s（クリックで詳細）」＋銀河内の進行方向を示す矢印（`SystemScene` に starIndex 0 のとき `ArrowHelper`）
- **クリック詳細**: 惑星クリックで 公転(速度・周期)/自転/地球からの最接近距離/光速・新幹線の所要時間。地球は「太陽から1AU(母星)」。太陽クリックで銀河公転パネル(220km/s・約2.3億年・銀河中心約2.6万光年・自転約7200km/h)
- **データ/純関数**: `src/system/solarFacts.ts`（`PLANET_FACTS`/`SUN_FACTS` + `earthClosestApproachAu`/`formatManKm`/`formatLightTravel`(既存 formatLightTime 委譲)/`formatShinkansenTravel`）

- spec: `docs/superpowers/specs/2026-07-06-stellar-voyage-solar-detail-design.md`
- plan: `docs/superpowers/plans/2026-07-06-stellar-voyage-solar-detail.md`（全4タスク）

**現 HEAD: `23c6c66`。範囲 `f704bcb..23c6c66` = 4タスク + Sun クリック/ラベル fix(d4765c3) + index クロスチェックテスト(659fd85) + user 追加調整(c072069 矢印→軌道線/km/h 縦並び, 23c6c66 パネル公転も km/h 統一[formatOrbitalKmH helper])。すべて `main`・未 push。**
**追加調整(c072069, user 2026-07-06)**: 太陽の進行方向矢印を削除し「銀河公転の軌道線」(太陽が上に乗る金色の弧)へ置換。惑星ラベルを複数行化(LabelLayer white-space:pre)し **公転を自転の上に・両方 km/h**(カンマ区切り)表示、軌道上の別公転ラベルは廃止。さらに(23c6c66)クリック詳細パネルの公転も km/s→km/h に統一(solarFacts の formatOrbitalKmH helper を label/panel 共用)。E2E 確認済。
opus 最終レビュー「Ready to merge — YES」（Critical/Important 0、5 named risk[solar-only gate/PLANET_FACTS index 整合/Sun クリック cone/facts無し不変/ヘルパ数値]健全）。173/173・tsc・build(495KB) 緑。Playwright E2E で全受入基準検証（公転/自転/逆回転ラベル・太陽の進行方向矢印・水星クリック[公転47.4/自転11/最接近9100万km/光5分4秒/新幹線35年]・地球[母星]・太陽クリック[銀河公転]）。実装/レビュー=sonnet、最終=opus。
E2E-driven fix(d4765c3): 太陽が点ピッキングで背後の背景星に負け拾えない→原点方向の角度判定(SUN_PICK_ANGLE=0.06)で pickStar 前に先取り＋常時ラベル短縮。所見: overview(viewDist40) は内惑星が中心に角度密集しラベルが重なる（拡大で分離＝標準UX、太陽も拡大時にクリック可）。deferred follow-up は progress.md 参照。

## 以前の完了 — 「局部銀河群の 3D 銀河（Phase 1）」ミルストーン ✅ 完了（2026-07-05）

一番ズームアウトした局部銀河群段の DOM 模式図を、天の川銀河とアンドロメダ銀河の **3D 渦巻きパーティクル**に置き換え。
- **銀河描画**: `src/galaxy/` に決定論生成（`buildGalaxyGeometry` + `mulberry32`、対数螺旋の腕+中心バルジ+円盤厚み）、`GalaxyDisk`（additive Points + `uOpacity` シェーダ）、`LocalGroup`（天の川 seed1 + アンドロメダ seed2 概念 offset `ANDROMEDA_OFFSET_AU=2.4e10` + 現在地マーカー）
- **クロスフェード**: `localGroupFade(viewDistanceAu)`（3e9→1e10 smoothstep）で近傍星野（`StarField` に `uOpacity`/`setOpacity` 追加）をフェードアウト・銀河群をフェードイン。`app.ts` が毎フレーム `-focusWorldAu` で相対配置＋現在地/約250万光年ラベル。旧 DOM `LocalGroupDiagram` は削除（3D 置換）
- 概念スケール圧縮（実250万光年は物理的に描けないためラベルで数値提示、アンドロメダは約2倍径・約3倍先）

- spec: `docs/superpowers/specs/2026-07-05-stellar-voyage-localgroup-galaxies-design.md`
- plan: `docs/superpowers/plans/2026-07-05-stellar-voyage-localgroup-galaxies.md`（全6タスク + 「実装ポリシー」節: 純粋ロジック=TDD厳密 / 見た目=実機調整）

**現 HEAD: `c815248`。範囲 `176614b..c815248` = 6タスク + midpoint/marker-fade/scratch fix + 二重太陽 fix(a27672e) + marker 構造堅牢化(cce074b) + 縮尺バー概念スケール整合(c815248: localgroup 段のみ縮尺バー非表示=実距離が概念ラベル「250万光年」と食い違うのを解消)。すべて `main`・未 push。**
opus 最終レビュー「Ready to merge — YES」（Critical/Important 0、4 named risk[概念スケール float 精度/クロスフェード境界/寿命/削除完全性]すべて健全と検証）。158/158・tsc・build(487KB) 緑。Playwright E2E で全受入基準（2つの渦巻き銀河・現在地/約250万光年ラベル・双方向クロスフェード・ドラッグ回転・全 overlay 非干渉・console は favicon404 のみ）検証済。実装/レビュー=sonnet、最終=opus。
**二重太陽 bug fix (user 報告 2026-07-06)**: 局部銀河群で天の川の中心(バルジ)を原点(=太陽=カメラ注視点=近傍星野=ズーム中心)に置いていたため、原点の太陽と現在地マーカー(腕にオフセット)が二重に見えズームインで銀河中心が太陽系になった。天の川円盤を SUN_DISK_OFFSET(=radius*0.55)だけずらし、太陽(原点)が銀河中心でなく銀河内の途中に来るよう修正(a27672e)、マーカーは group 原点直下に固定して傾き非依存で構造保証(cce074b)。opus 座標系整合監査で全ズーム段・pan とも同クラスの他バグ無し・pan divergence は非バグと確認。E2E で二重太陽解消を確認。詳細は progress.md。
**Phase 2（次のミルストーン）**: アンドロメダへ飛んで移動（viewDist 連動の速度スケーリング/ワープ機構が必須）＋アンドロメダ内部の手続き生成星野（天の川 HYG と対称の別世界）。user 承認済み方針。deferred minors（除算ガード/ANDROMEDA テスト/tinyColumns dup）は progress.md 参照。

## 以前の完了 — 「縮尺バー + 局部銀河群（アンドロメダ）」ミルストーン ✅ 完了（2026-07-05）

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
- **実装ゾーン分離（描画ミルストーン共通の方針）**: 純粋ロジック（数値境界・決定論生成・構造や uniform 反映・座標計算）は superpowers TDD で**厳密に固める**。一方、**見た目の数値（色・サイズ・傾き・配置・pixelScale・見栄えパラメータ定数）はテストで assert しない** — コントローラが Playwright E2E で目視調整するため。テストは「値を変えても壊れない構造的不変条件」だけを検証する。サブエージェント派遣時はこの TDD 厳密／実機調整の区分を brief に必ず明示する（詳細は各 plan 冒頭「実装ポリシー」節）。

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
