# stellar-voyage 恒星系の公転アニメーション 設計

**Goal:** 恒星系ビューで惑星を軌道に沿って公転させる（時間で回る）。太陽（中心星）は中心に静止、惑星は内側ほど速く回る（ケプラー第三法則の相対速度）。惑星メッシュ・ラベル・クリック判定が同じ現在位置を使い、動く惑星を正しく追従・選択できる。太陽系を含む全恒星系に適用。

## Architecture

現状: `SystemScene` は惑星メッシュを構築時に `orbitPosition(a, planetPhase(starIndex, i))`（静的位相）で配置。`app.ts` のラベルと `pickPlanet` も各自同じ静的位相で位置を再計算。→ 3 箇所が独立計算のため、アニメで位置がずれる。

方針: **位相を時間で進める純関数**を `orbit.ts` に追加し、**`SystemScene.update(t)` を毎フレーム呼んで惑星メッシュ位置を更新（現在位置の唯一の真実）**。app.ts のラベルとクリック判定は「メッシュの現在位置」を使う（`pickPlanet` を位置配列を受け取る形へ小改修）。太陽（中心星メッシュ）は原点固定。

## Global Constraints（プロジェクト既存を継承）

- ユーザー向け文言は日本語。ワールド単位 AU。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。純粋ロジックは vitest 単体、動き・クリック追従は Playwright 目視（コントローラ）。
- 実装ポリシー: **TDD厳密**=`orbitalAngularSpeed`/`animatedPhase` の純関数（単調性・境界・t=0）、`pickPlanet` の位置ベース選択。**実機調整**=アニメの時間スケール（地球の周回秒数）・見え方（テストで秒数を厳密固定しない、範囲/単調性のみ）。
- コミット末尾 `Co-Authored-By: Claude <実装モデル> <noreply@anthropic.com>`、署名エラー時 `git -c commit.gpgsign=false commit`、`--no-verify` 禁止。ビルド系は監査 hook 時 `# CLAUDE_AUDIT_OK`。

## 既存モジュール（依存/改修）

- `src/system/orbit.ts`: `orbitPosition(a, phase)`, `planetPhase(starIndex, i)`（既存, 不変）。**追加**: `orbitalAngularSpeed(a)`, `animatedPhase(starIndex, i, a, t)`。
- `src/system/SystemScene.ts`: 中心星 + 惑星メッシュ(`planetMeshes`) + 軌道リング + 土星の環 + PointLight。**改修**: `update(t)` 追加（惑星メッシュ位置 + 土星の環位置を更新）。土星の環メッシュ参照を保持。
- `src/system/planetPick.ts`: `pickPlanet(cameraPos, rayDir, system, maxAngle)`。**改修**: 位置配列を受け取る `pickPlanet(cameraPos, rayDir, positions, maxAngle)` に変更（内部で位相再計算しない）。
- `src/app.ts`: frame ループ・ラベル分岐・クリック（`pickPlanet`）を改修。経過時間 `animT` を累積。

## 新規/変更する純関数（`src/system/orbit.ts`）

```
const ANIM_EARTH_PERIOD_SEC = 12;             // 地球(a=1)が1周する秒数（live-tune）
const ANIM_K = (2 * Math.PI) / ANIM_EARTH_PERIOD_SEC;
const ANIM_MAX_OMEGA = Math.PI;               // 角速度上限(≈2秒/周)。極端に内側の惑星の高速スピンを防ぐ

/** ケプラー第三法則: 角速度 ∝ a^-1.5（内側ほど速い）。上限クランプ付き。rad/秒。 */
orbitalAngularSpeed(semiMajorAxisAu): number
  = Math.min(ANIM_K * Math.pow(semiMajorAxisAu, -1.5), ANIM_MAX_OMEGA)

/** 時刻 t 秒での軌道位相 = 初期位相 + ω·t */
animatedPhase(starIndex, planetIndex, semiMajorAxisAu, t): number
  = planetPhase(starIndex, planetIndex) + orbitalAngularSpeed(semiMajorAxisAu) * t
```

- `a > 0`。`a=1` で ω = 2π/12（地球 12 秒/周）。`a` が小さいほど ω 大（Mercury a=0.39 → 約2.9秒/周）、大きいほど小（Neptune a=30 → 約33分/周）。上限で 2 秒/周に制限。

## `SystemScene.update(t)`（新規メソッド）

- 構築時に土星の環メッシュ参照を保持（`private readonly ringByPlanet` 等）。既存の惑星メッシュは `planetMeshes[i]`。
- `update(t: number): void`: 各惑星 i について `const [x,y,z] = orbitPosition(a_i, animatedPhase(system.starIndex, i, a_i, t)); planetMeshes[i].position.set(x,y,z);`。`hasRing` の惑星（土星）の環メッシュも同じ (x,y,z) へ。
- 中心星・軌道リング（円）・PointLight は不変。`a_i = system.planets[i].semiMajorAxisAu`。

## `pickPlanet` 改修（位置ベース）

```
pickPlanet(cameraPos, rayDir, positions: readonly [number,number,number][], maxAngleRad): number | null
```
- `positions[i]` を各惑星の現在位置として角度選択（既存の cos 判定ロジックはそのまま、`orbitPosition/planetPhase` の内部計算を除去）。
- 呼び出し側 `app.ts` が `systemScene.planetMeshes[i].position` から現在位置配列を作って渡す。

## `app.ts` 結線

- `startApp` 内に `let animT = 0;`。frame ループ先頭付近で `animT += dt;`（既存 `dt`）。
- `systemScene` が存在すれば毎フレーム `systemScene.update(animT);`（フェード可視かに関わらず更新でよい。負荷は8メッシュの position 設定のみ）。
- ラベル（system view, `fade>0.5`）: 各惑星の worldPos を `systemScene.planetMeshes[i].position`（現在位置）から取得（`orbitPosition(a, planetPhase)` の再計算をやめる）。太陽系の 公転/自転 ラベル文言は不変。
- クリック（`pickPlanet`）: `const positions = currentSystem.planets.map((_, i) => systemScene!.planetMeshes[i]!.position.toArray() as [number,number,number]);` を作り `pickPlanet(cam, rayDir, positions, PLANET_PICK_ANGLE)` へ。
- 全恒星系に適用（太陽系も手続き系も惑星が回る）。太陽（中心星）は原点静止。

## 受入基準（目視・コントローラ）

1. 太陽系ビューで惑星が軌道に沿って公転する（内惑星ほど速く、外惑星はゆっくり）。太陽は中心に静止。
2. 動いている惑星に**ラベルが追従**する（名前/公転/自転ラベルが惑星と一緒に動く）。土星の環が土星と一緒に動く。
3. 動いている惑星を**クリックで選択**でき、正しい惑星の詳細パネルが出る。
4. 別の星（手続き系）に突入しても惑星が公転する。軌道リングは静止、既存の他表示は不変。

## File Structure
```
src/system/orbit.ts              # 追加: orbitalAngularSpeed, animatedPhase
src/system/SystemScene.ts        # 改修: update(t) + 土星の環参照保持
src/system/planetPick.ts         # 改修: pickPlanet が位置配列を受け取る
src/app.ts                       # 改修: animT 累積・update 呼び出し・ラベル/クリックを現在位置ベースに
tests/system/orbit.test.ts       # 追記: orbitalAngularSpeed/animatedPhase
tests/system/planetPick.test.ts  # 改修: 新シグネチャ（位置配列）
tests/system/systemScene.test.ts # 追記: update(t) 後に惑星メッシュ位置が変わる
```

## テスト
- `orbitalAngularSpeed`: `a` 単調減少（0.39 > 1 > 30 の順で ω 大→小）、`a=1` で `≈2π/12`、極小 `a` で上限 `ANIM_MAX_OMEGA` にクランプ。
- `animatedPhase`: `t=0` で `planetPhase` に一致、`t>0` で単調増加、`ω(a)·t` 分ずれる。
- `pickPlanet`（新シグネチャ）: 与えた位置配列に対しレイに最も近い index を返す・範囲外は null。既存テストを位置配列渡しに更新。
- `SystemScene.update(t)`: `update(0)` と `update(t>0)` で `planetMeshes[i].position` が変化する（内惑星が動く）。値の厳密固定はしない（実機調整のため）。
- Playwright E2E: 受入基準 1〜4（公転・ラベル追従・クリック追従・手続き系）。時間スケールは live-tune。
