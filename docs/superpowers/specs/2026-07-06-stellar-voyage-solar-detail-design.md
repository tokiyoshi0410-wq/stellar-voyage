# stellar-voyage 太陽系の詳細表示 設計

**Goal:** 太陽系ビューを教育的に詳しくする。各惑星の**公転速度**を軌道上に、**自転速度（赤道）**を惑星の近くに常時ラベル表示。**太陽**にも銀河公転の速度ラベル＋進む向きの矢印を追加。惑星をクリックすると詳細パネルに**地球からの最接近距離**と**光速・新幹線での所要時間**を追加表示する。**太陽系（starIndex 0）限定**で、手続き生成の恒星系は現状のまま。

## Architecture

現状: `SystemScene` が Sun スフィア + 惑星スフィア + 軌道リングを描画。`app.ts` の frame ループが system view（fade>0.5）で中央星ラベル + 各惑星ラベル（名前 + AU + 億km）を出し、クリックで `PlanetPanel`（種別/AU/半径/質量/HZ）。

追加方針:
- **太陽系専用の実データ**を新モジュール `src/system/solarFacts.ts` に集約（8惑星の公転速度・公転周期・自転赤道速度・逆回転フラグ、太陽の銀河公転データ）＋純関数ヘルパ（最接近距離、光速/新幹線の所要時間換算）。
- 太陽系かどうかは `system.starIndex === 0`（Sun=HYG index 0、`getSolarSystem` が index 0 に使われる）で判定。この時だけ詳細を出す。
- **常時ラベル**は `app.ts` の system-view ラベル分岐を拡張（`LabelLayer` に項目追加）。
- **クリックパネル**は `PlanetPanel.describePlanet` を拡張（太陽系の惑星のときだけ追加行）。
- **太陽の矢印**は `SystemScene`（starIndex 0 のとき）に小さな `ArrowHelper` を追加。

## Global Constraints（プロジェクト既存を継承）

- ユーザー向け文言は**日本語**、平易な表現。ワールド単位 **AU**。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。純粋ロジックは vitest 単体、ラベル/パネル/矢印は Playwright 目視（コントローラ）。
- 実装ポリシー（TDD厳密 / 実機調整の区分）: **TDD厳密**=`solarFacts` の純関数（最接近距離・光速/新幹線換算・逆回転・データ配列長）、`PlanetPanel` の文言生成（追加行の有無・数値書式）。**実機調整**=ラベルの正確な配置/角度、矢印の長さ・向き・色、文字の密度（値は assert しない）。
- コミット末尾 `Co-Authored-By: Claude <実装モデル> <noreply@anthropic.com>`、署名エラー時 `git -c commit.gpgsign=false commit`、`--no-verify` 禁止。ビルド系は監査 hook 時 `# CLAUDE_AUDIT_OK`。
- 全オーバーレイ `pointer-events:none`（既存 LabelLayer/PlanetPanel の踏襲）。

## 既存モジュール（依存/改修）

- `src/system/types.ts`: `Planet`（name/type/semiMajorAxisAu/radiusEarth/massEarth/...）、`StellarSystem`（starIndex/starName/planets...）。**改修なし**（詳細データは別テーブルに持つ＝汎用型を汚さない）。
- `src/system/solarSystem.ts`: `getSolarSystem(): Planet[]`（8惑星、index 0=水星…7=海王星）。solarFacts はこの index に整合。
- `src/system/orbit.ts`: `orbitPosition(a, phase)`、`planetPhase(starIndex, i)`。ラベル配置に再利用。
- `src/system/SystemScene.ts`: Sun スフィア + 惑星 + リング。**改修**: starIndex 0 のとき太陽の進行方向矢印を追加。
- `src/ui/PlanetPanel.ts`: `describePlanet(p)` + `PlanetPanel`。**改修**: 太陽系の惑星に追加行（後述）。`show(planet, facts?)` に facts を渡す。
- `src/ui/format.ts`: `AU_IN_OKUKM=1.496`（既存）。`starDisplayName`（既存）。
- `src/edu/scaleInfo.ts`: `formatLightTime(lightMinutes)`（既存、秒/分/時間/日/年）。光速所要時間はこれを再利用。
- `src/app.ts`: system-view ラベル分岐（`fade>0.5`）とクリック選択（`pickPlanet`→`planetPanel.show`）を改修。

## 新規モジュール `src/system/solarFacts.ts`（純粋データ＋ヘルパ）

```
interface PlanetFacts { orbitalSpeedKmS: number; orbitalPeriodYr: number; rotationSpeedKmH: number; retrograde: boolean }
PLANET_FACTS: PlanetFacts[]  // getSolarSystem と index 整合（0=水星…7=海王星）
interface SunFacts { galacticSpeedKmS: number; galacticPeriodYr: number; galacticCenterLy: number; rotationSpeedKmH: number }
SUN_FACTS: SunFacts
```

データ（実測値、実機で微調整不可の事実値）:
| # | 惑星 | 公転 km/s | 公転周期 yr | 自転赤道 km/h | 逆回転 |
|---|---|---|---|---|---|
|0|水星|47.4|0.24|11|no|
|1|金星|35.0|0.62|6.5|**yes**|
|2|地球|29.8|1.00|1674|no|
|3|火星|24.1|1.88|866|no|
|4|木星|13.1|11.9|45000|no|
|5|土星|9.7|29.5|35500|no|
|6|天王星|6.8|84|9320|**yes**|
|7|海王星|5.4|165|9660|no|

`SUN_FACTS = { galacticSpeedKmS: 220, galacticPeriodYr: 2.3e8, galacticCenterLy: 26000, rotationSpeedKmH: 7200 }`

純関数ヘルパ:
```
const AU_KM = 1.496e8; const LIGHT_KM_S = 299792.458; const SHINKANSEN_KMH = 300;
earthClosestApproachAu(a): number  = Math.abs(a - 1)   // 円軌道近似の最接近（AU）
formatManKm(au): string            // au*AU_KM/1e4 を「約N万km」/「約N億km」(>=1e4万km)で
formatLightTravel(au): string      // = formatLightTime(au*AU_KM/LIGHT_KM_S/60)（分に換算し既存 formatLightTime へ）
formatShinkansenTravel(au): string // hours=au*AU_KM/SHINKANSEN_KMH; years=hours/8760; years>=1→「約N年」/ else「約N日」
```
- すべて決定的な純関数。逆回転は表示側で「(逆)」付記に使う。

## 常時ラベル（`app.ts` の system-view 分岐、`system.starIndex === 0` のときのみ追加）

現状 `fade>0.5` で `中央星ラベル` + 各惑星 `名前 + AU ≈ 億km` を push。太陽系のとき、以下を追加/置換:
- **各惑星の近く**（既存の惑星位置ラベル）: `${名前} ・ 自転 ${rotationSpeedKmH} km/h${retrograde?'(逆)':''}`（AU 表記は残し `${名前}  ${AU} ・ 自転 …` としてよい＝実機で調整）。
- **各惑星の軌道リング上**: `公転 ${orbitalSpeedKmS} km/s` を `orbitPosition(a, planetPhase(0,i) + Math.PI/2)`（惑星から約90°ずらした軌道上の点。重なり回避角は live-tune）に push。
- **太陽の近く**: `太陽 ・ 公転 ${SUN_FACTS.galacticSpeedKmS} km/s（銀河を約${億年表記}で1周）・ 自転 赤道約 ${SUN_FACTS.rotationSpeedKmH} km/h`（worldPos=[0,0,0]、中央星ラベルを置換）。「約2.3億年」は `2.3e8` を「億年」書式で。
- 太陽系以外（procedural）は現状のラベルのまま（分岐で非適用）。

## クリック詳細パネル（`PlanetPanel` / `describePlanet` 改修）

- `PlanetPanel.show(planet, facts?, closestAu?)`: 太陽系の惑星のとき facts を渡す。`describePlanet(planet, facts?, closestAu?)` は facts があれば既存出力の後に追加:
  - `公転: ${orbitalSpeedKmS} km/s ・ 周期 ${orbitalPeriodYr} 年`
  - `自転: 赤道 ${rotationSpeedKmH} km/h${retrograde?'(逆回転)':''}`
  - 地球以外: `地球から最接近: ${formatManKm(closestAu)}（約${closestAu.toPrecision(2)} AU）` / `　光の速度で 約${formatLightTravel(closestAu)}` / `　新幹線(300km/h)で ${formatShinkansenTravel(closestAu)}`
  - 地球（index 2）: `太陽からの距離: 1 AU（母星）`（最接近0のため距離/所要時間行は出さない）
- 太陽クリック時（機構）: 現状 system-view のクリックは `pickPlanet`（惑星）→ 無ければ `pickStar`（カタログ星）。**太陽系（starIndex 0）で `pickStar` が index 0（太陽）を返したら、`describeStar` ではなく太陽専用文をパネルに出す**（`PlanetPanel` に `showText(text)` を追加、または `InfoPanel` に太陽文を流す）。太陽専用文: `太陽\n銀河公転: ${SUN_FACTS.galacticSpeedKmS} km/s（銀河を約2.3億年で1周）\n銀河中心まで: 約2.6万光年\n自転: 赤道 約${SUN_FACTS.rotationSpeedKmH} km/h`（`galacticCenterLy=26000`→「約2.6万光年」、`galacticPeriodYr=2.3e8`→「約2.3億年」= `/1e8` の `toPrecision(2)`）。

## `SystemScene` 改修（太陽の進行方向矢印）

- `constructor` で `system.starIndex === 0` のとき、Sun スフィアの近くに `THREE.ArrowHelper`（向き=固定の見栄えの良い方向 例 `(1,0,0.3).normalize()`、長さ ~1.2 AU、色 `0xffd479`、原点 (0,0,0)）を `this.root` に追加。手続き系（starIndex≠0）には出さない。矢印の向き/長さ/色は live-tune。
- `dispose` は既存の `root.traverse` で Mesh を破棄。ArrowHelper はライン＋コーンなので、dispose 時に ArrowHelper の geometry/material も解放（`arrow.line`/`arrow.cone`）するか、traverse で拾えるか実装時に確認（拾えなければ明示 dispose）。

## 受入基準（目視・コントローラ）

1. 太陽系ビューで、各惑星の軌道上に「公転 ○ km/s」、惑星の近くに「(名前) ・ 自転 ○ km/h」（金星・天王星は「(逆)」）が常時表示される。
2. 太陽の近くに「太陽 ・ 公転 220km/s（銀河を約2.3億年で1周）・ 自転 赤道約7200km/h」と、太陽から伸びる進行方向の矢印が表示される。
3. 火星をクリックすると、既存情報に加えて「公転24.1km/s・周期1.88年」「自転 赤道866km/h」「地球から最接近 約7800万km（約0.52AU）」「光の速度で 約4分」「新幹線で 約30年」が出る。地球をクリックすると「太陽からの距離 1 AU（母星）」。
4. 太陽をクリックすると銀河公転の専用情報（220km/s・約2.3億年で1周・銀河中心まで約2.6万光年・自転 赤道約7200km/h）がパネルに出る。
5. 手続き生成の恒星系（別の星に突入）ではこれらの追加表示は出ず、現状のまま。クリック・既存パネルを妨げない。

## File Structure
```
src/system/solarFacts.ts         # 新規（純粋）: PLANET_FACTS/SUN_FACTS + 最接近/光速/新幹線ヘルパ
src/system/SystemScene.ts        # 改修: starIndex 0 で太陽の進行方向 ArrowHelper
src/ui/PlanetPanel.ts            # 改修: describePlanet に facts/closestAu 追加行 + show 署名拡張
src/app.ts                       # 改修: 太陽系のとき 公転/自転/太陽ラベル、太陽クリックパネル、惑星クリックに facts 引き渡し
tests/system/solarFacts.test.ts  # 新規
tests/ui/planetPanel.test.ts     # 新規/追記: 太陽系惑星の追加行・地球特例
```

## テスト
- `solarFacts`: `PLANET_FACTS.length === 8`、`earthClosestApproachAu(1.52)≈0.52`・`(1)===0`、`formatManKm`（0.52AU→「約7800万km」帯、4.2AU→「約6.3億km」帯）、`formatLightTravel`（火星0.52AU→「約4分」相当）、`formatShinkansenTravel`（0.52AU→「約30年」、29.1AU→「約1700年」帯）、逆回転フラグ（金星/天王星 true）。値の桁は決定的に検証（見た目文字列の完全一致でなく妥当域）。
- `PlanetPanel`/`describePlanet`: facts 有りで公転/自転/距離/所要時間行を含む、facts 無し（procedural）で従来通り、地球で距離行を出さず「母星」表記。textContent XSS 安全。
- Playwright E2E: 受入基準 1〜5（ラベル・矢印・パネル・太陽クリック・procedural 非適用）。配置は live-tune。
