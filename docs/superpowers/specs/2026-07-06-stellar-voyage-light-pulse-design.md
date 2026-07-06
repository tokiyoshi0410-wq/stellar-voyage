# 光速パルス（光速の遅さを体感する演出）設計

日付: 2026-07-06
ステータス: 実装完了。**ただし下記「設計の肝＝見た目一定速度」は 2026-07-07 に撤回**。user「光速を現実と同じに（今は速すぎ）」を受け、波紋の速度を視距離比例の一定画面テンポ→**現実の光速で固定**（`pulseGrowthAuPerSec()` を LIGHT_ACCEL_MIN_PER_SEC/LIGHT_MIN_PER_AU の定数に）へ変更した。太陽系で光の遅さを実速度で体感し、大スケールでは光が止まって見える（現実そのもの）。最新の一次ソースは `.superpowers/sdd/progress.md` の「Light Pulse」節（FOLLOW-UP 参照）。以下の本文は当初設計の記録。

## 目的

連続ズーム航法の中で、**光速で進む光の波紋**を発射できるようにし、「光速でも宇宙空間ではこんなに遅い」を目で見て体感させる。太陽系では光は8分で地球に届くが、恒星間では隣の星まで何年経っても届かない——これを同じ操作で連続的に見せる（小学生にも直感で伝わる教育演出）。

## user が決めた要件（brainstorming 2026-07-06）

1. **見せ方**: 光のパルス（波紋）を実際に飛ばす。
2. **スケール**: 全スケール連動（太陽系＝分 / 恒星間＝年 / 銀河＝万年）。
3. **時間**: 経過時間カウンタ＋早送り。「発射から○分/○年」を出す。
4. **発射**: ボタンで「光を放つ」。中心の星（フォーカス星＝原点）から球状に広がる。
5. **範囲**: 案A（波紋＋経過時間カウンタ＋主要天体への到達通知）。

## 設計の肝：見た目は一定速度、時間だけ桁違い

- **波紋の広がる速さを画面基準で一定にする**。成長速度 `dr/dt ∝ 現在の viewDistanceAu`。どのスケールでも波紋は同じテンポで広がって見える。
- **カウンタは実際の光行時間**（`半径 ÷ 光速` = `radiusAu × 8.317 分`）を表示。太陽系では「分」、恒星間では「年」、銀河では「万年」と自動で単位が変わる。
- 結果：**「波紋は同じ速さで広がっているのに、カウンタは何年も回っている」**＝「光速なのにこんなに遅い」の体感。太陽系では地球に8分で届くのに、恒星間では隣の星まで何年経っても届かない、が同じ操作で連続的に分かる。
- ズーム中に発射済みパルスがあっても、成長速度は現在の viewDistance に追従（見た目テンポ一定）。カウンタは物理量なのでズームに依らず正しい。

## コンポーネント

### 純粋ロジック（TDD で厳密に固める）
`src/edu/lightPulse.ts`:
- `pulseGrowthAuPerSec(viewDistanceAu: number): number` — 波紋の成長速度。`PULSE_SPEED_FRACTION × viewDistanceAu`（`PULSE_SPEED_FRACTION` は「realtime 1秒でビューの何割広がるか」の見た目定数・実機調整）。viewDistanceAu に対し単調増加・正。
- `pulseLightTimeMin(radiusAu: number): number` — 光行時間（分）= `radiusAu × LIGHT_MIN_PER_AU`（8.317、scaleInfo と同値）。radiusAu に比例。
- `formatPulseTime(lightMinutes: number): string` — 人間可読な光行時間。既存 `formatLightTime`（秒/分/時間/日/年）を基礎に、**光行時間が1万年以上のときは「約N万年」**に整形する薄いラッパ（銀河スケールで既存関数の指数表記 "約1.0e+5年" を避ける）。
- `pulseReached(radiusAu: number, targetAu: number): boolean` — `radiusAu >= targetAu`。

### 描画・UI（実機で調整。テストは構造的不変条件のみ）
- `src/edu/LightPulse.ts`: Three.js の半透明球（`SphereGeometry` を `scale` で拡大 / additive・`depthWrite:false`）。中心星＝原点に配置。`update(radiusAu)` で半径反映、`setVisible`、`dispose`。
- `src/ui/EmitButton.ts`: 「💡 光を放つ」ボタン（`PauseButton` と同じ DOM 流儀・root 配置）。発射中は「もう一度で再発射」。onClick コールバック。
- 経過時間カウンタ: 既存 `ScalePanel` と同じ DOM オーバーレイ流儀の小コンポーネント（`src/ui/PulseReadout.ts`）。「光の経過時間: 8分19秒 ／ 到達: 地球」等。既存パネルと重ならない位置（発射ボタン近辺）。`pointer-events:none`。

### 統合（app.ts）
- 発射: `emitAnimT = animT`、`pulseActive = true`、`radius = 0`。
- 毎フレーム: `if (pulseActive && !paused) radius += pulseGrowthAuPerSec(viewDistanceAu) * dt`。`lightPulse.update(radius)`、カウンタ更新（`formatPulseTime(pulseLightTimeMin(radius))`）。
- **pause 連動**: 既存の一時停止（Space / 停止ボタン）で `!paused` ゲートに乗せ、波紋も止まる（惑星公転・銀河自転と同じ `animT` 機構）。
- 到達通知: 発射時フォーカス星の系（`currentSystem.planets` の `semiMajorAxisAu`）に対し `pulseReached` で「○○に到達（光でX）」。恒星間・銀河では加えて「最寄りの星まであと○年」（`nearestStars` の最寄り1つ、`pc→AU` 換算）。

## テスト方針（実装ゾーン分離）

- **純粋ロジック**（`lightPulse.ts` の4関数）は TDD で厳密に（RED→GREEN）。成長速度の単調性・正値、光行時間の比例と既知値（1 AU→8分19秒）、`formatPulseTime` の単位境界（分/年/万年）、`pulseReached` の境界（`radius==target`）。
- **見た目**（波紋の色・不透明度・`PULSE_SPEED_FRACTION`・球の質感・カウンタ配置）はテストで assert せず、コントローラが Playwright E2E で目視調整。
- **描画コンポーネント**（`LightPulse`/`EmitButton`/`PulseReadout`）は構造的不変条件（`update` が scale に反映・`dispose` が geometry/material 解放・ボタン click がコールバック発火）のみ軽くテスト。

## 受入基準

1. 「💡 光を放つ」ボタンで中心星から光の波紋が球状に広がる。
2. 経過時間カウンタが実光行時間を単位自動（分→年→万年）で表示。
3. 太陽系で地球到達「8分19秒」等、惑星への到達が通知される。
4. 全スケールで波紋のテンポは一定、カウンタだけが桁違いに増える（恒星間で「何年経っても最寄り星に届かない」）。
5. 一時停止（Space / 停止ボタン）で波紋も止まり、再開で続く。
6. 既存機能（公転アニメ・クリック選択・ラベル・4段スケール）に無回帰。

## 非目標（YAGNI）

- 到達済みマーカーの常設表示、光速の等時リング重畳、複数パルス同時（案C 相当）は今回やらない。
- 相対論的効果・ドップラー等の物理再現はしない（教育的直感が目的）。
