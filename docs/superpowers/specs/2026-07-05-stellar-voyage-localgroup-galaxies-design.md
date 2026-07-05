# stellar-voyage 局部銀河群の 3D 銀河（Phase 1）設計

**Goal:** 一番ズームアウトした「局部銀河群」段で、これまでの DOM 模式図に代えて、天の川銀河とアンドロメダ銀河を **3D の渦巻きパーティクル**として描く。両銀河の形・大きさ・約250万光年の位置関係が視覚的に分かり、アンドロメダ方向へ前進すると渦巻きが大きく見える（＝近づける）。星の名前は出さない。

**スコープ（Phase 1 のみ）:** 局部銀河群の 3D 概念シーン＋アンドロメダへ寄る航法まで。**アンドロメダ内部の星野突入は Phase 2（別 spec）** とし本 spec に含めない。

## 制約：実スケールは描けない → 概念スケール圧縮

`MAX_VIEW_AU = 5e10 AU ≈ 79万光年`（NavigationController のズーム上限）。アンドロメダの実距離250万光年には届かず、実スケールでは両銀河とも点にしかならない。よって**視覚的距離は模式的に圧縮**し、正確な「約250万光年」は教育文（ScalePanel）とラベルで数値提示する（現 DOM 模式図と同じ考え方）。

## Architecture

`nav.viewDistanceAu`（既存ズーム状態）と `nav.focusWorldAu`（既存の移動状態、AU 単位）に連動。

- **銀河描画**は既存のフォーカス相対空間（AU 単位）にそのまま置く。天の川銀河の中心を world 原点、アンドロメダをその先の概念距離に固定配置した THREE.Group を、毎フレーム `group.position = -focusWorldAu` で相対化（カメラは既存どおり原点周回）。前進すると焦点が動き、アンドロメダが原点＝注視点へ寄る。
- 銀河は 1e9〜1e10 AU オーダーと巨大なので、近傍星野のようなシェーダ相対（pc 精度確保）は不要。CPU 側の `group.position` オフセットで float32 精度は十分（誤差 ~1e3 AU ≪ 銀河サイズ 8e9 AU）。
- **フェード**: 新 `localGroupFade(viewDistanceAu)`（3e9→1e10 で 0→1）。localgroup 段に入ると近傍星野がフェードアウトし銀河群がフェードイン。恒星系は既に systemFade=0 の領域なので無関係。
- **段判定は既存 `scaleInfoFor` の `localgroup`（viewDistanceAu>=1e10）をそのまま使う。**

## Global Constraints（プロジェクト既存を継承）

- ユーザー向け文言は**日本語**、小学生が読める平易な表現。ワールド単位 **AU**。ランタイム依存は Three.js のみ。`"type":"module"`。
- TS strict + `noUncheckedIndexedAccess`。純粋ロジックは vitest 単体。描画・フェード・遷移は Playwright 目視（コントローラ）。
- 銀河生成は決定論的（seed 固定、既存 `mulberry32` を再利用）。テスト可能な純関数として切り出す。
- コミットはタスク単位、末尾 `Co-Authored-By: Claude <実装モデル> <noreply@anthropic.com>`、署名エラー時 `git -c commit.gpgsign=false commit`、`--no-verify` 禁止。ビルド系は監査 hook 時 `# CLAUDE_AUDIT_OK`。
- 既存オーバーレイ配置は不変（ScalePanel=左上、ScaleBar=左下、InfoPanel/PlanetPanel=右上）。全オーバーレイ `pointer-events:none`。

## 既存モジュール（依存/改修）

- `src/system/rng.ts`: `mulberry32(seed): () => number`（再利用）。
- `src/starfield/StarField.ts` + `starfield.frag.glsl`: **改修** — `uOpacity` uniform 追加＋frag で `alpha * uOpacity`、`StarField.setOpacity(o)` を追加（既定 1.0、既存挙動不変）。
- `src/nav/NavigationController.ts`: `focusWorldAu`（AU）、`viewDistanceAu`。改修なし。
- `src/ui/LabelLayer.ts`: `render(items, camera, canvas)`（既存）。現在地・距離ラベルに再利用。
- `src/edu/scaleInfo.ts`: `localgroup` 段（既存）。改修なし（教育文は流用）。
- `src/app.ts`: frame ループへ結線。**旧 DOM `LocalGroupDiagram` の生成・setVisible を撤去**。
- `src/ui/LocalGroupDiagram.ts`: **削除**（3D に置換）。

## 新規モジュール

### `src/galaxy/galaxyParams.ts`（定数）
```
interface GalaxyParams {
  count: number; radiusAu: number; armCount: number; windings: number;
  thicknessAu: number; bulgeFraction: number;
  coreColor: [number,number,number]; armColor: [number,number,number];
}
MILKY_WAY: 半径 4e9, 腕2, 巻き2.5, 厚み 3e8, bulge 0.15, core 淡黄[1.0,0.95,0.8], arm 青白[0.7,0.8,1.0], count 8000
ANDROMEDA: 半径 8e9（天の川の2倍）, 腕2, 巻き3.0, 厚み 5e8, bulge 0.18, core 黄白[1.0,0.9,0.7], arm 淡青[0.8,0.85,1.0], count 12000
ANDROMEDA_OFFSET_AU = 2.4e10（天の川直径の約3倍先、x 軸方向）
```

### `src/galaxy/GalaxyDisk.ts`（純粋生成＋クラス）
- `buildGalaxyGeometry(p: GalaxyParams, seed: number): { positions: Float32Array; colors: Float32Array; sizes: Float32Array }`
  - `rng = mulberry32(seed)`。各点 i について:
    - `radius = p.radiusAu * Math.sqrt(rng())`（中心寄り分布）。
    - **バルジ**（`i < count*bulgeFraction`）: 中心の球状密集（`br = p.radiusAu*0.15*Math.cbrt(rng())` + 球面ランダム方向で xyz）、色 = coreColor、size 大（例 2.2）。
    - **円盤**（残り）: `arm = i % armCount`; `armAngle = arm*2π/armCount`; 対数螺旋 `spiral = armAngle + windings*2π*(radius/radiusAu)`; 腕の太さジッター `jitter=(rng()-0.5)*0.5`; `angle = spiral + jitter`; `x=radius*cos(angle)`, `z=radius*sin(angle)`, `y=(rng()-0.5)*thicknessAu*(1-0.7*radius/radiusAu)`（外周ほど薄い）。色 = coreColor→armColor を `t=radius/radiusAu` で線形補間（±小ジッター）、size = lerp(1.6,0.7,t)。
  - XZ が円盤面（既存の軌道面と一致）。全点が半径・厚み内に収まる（テスト対象）。
- `class GalaxyDisk { readonly object: THREE.Points; constructor(p, seed); setOpacity(o): void; dispose(): void }`
  - ShaderMaterial（additive, transparent, depthWrite:false, vertexColors）＋ `galaxy.vert/frag.glsl`。`uPixelScale`（例 400）、`uOpacity`。`object.frustumCulled=false`。

### `src/galaxy/galaxy.vert.glsl` / `galaxy.frag.glsl`（新規シェーダ）
- vert: `mv=modelViewMatrix*vec4(position,1.0)`; `gl_Position=projectionMatrix*mv`; `gl_PointSize=clamp(size*uPixelScale/max(-mv.z,0.001),1.0,24.0)`; `vColor=color`。
- frag: `alpha=1.0-smoothstep(0.0,0.5,length(gl_PointCoord-0.5))`; `gl_FragColor=vec4(vColor, alpha*uOpacity)`。

### `src/galaxy/LocalGroup.ts`（束ね役）
- `class LocalGroup { readonly object: THREE.Group; constructor(); setOpacity(o): void; setPosition(x,y,z): void; markerWorldPos(): [number,number,number]; midpointWorldPos(): [number,number,number]; dispose(): void }`
  - 天の川 `GalaxyDisk(MILKY_WAY, seed=1)`（原点、見栄えのため `rotation.x≈0.5` で傾ける）。
  - アンドロメダ `GalaxyDisk(ANDROMEDA, seed=2)`（`position.x=ANDROMEDA_OFFSET_AU`、`rotation.x≈0.7, rotation.z≈0.3`）。
  - 現在地マーカー: 天の川円盤内（中心から半径 `radiusAu*0.55` の腕上）に小さな明るい点／リング（`marker` Object3D）。`markerWorldPos()` は `object.position` 反映後の world 座標を `marker.getWorldPosition` で返す。
  - `midpointWorldPos()`: 天の川中心とアンドロメダ中心の world 中点（「約250万光年」ラベル用）。
  - `setOpacity` は両 GalaxyDisk へ委譲。`setPosition` は `object.position` を設定（`-focusWorldAu` を渡す）。

### `src/nav/localGroupFade.ts`（純粋）
- `localGroupFade(viewDistanceAu): number` = smoothstep：`t=clamp((v-3e9)/(1e10-3e9),0,1); return t*t*(3-2*t)`。3e9 以下=0、1e10 以上=1。

## `src/app.ts` 結線

- 生成: `const localGroup = new LocalGroup(); engine.scene.add(localGroup.object);`。旧 `LocalGroupDiagram` の生成・`setVisible` 行を削除。
- frame ループ（フェード計算の近く）:
  - `const lgFade = localGroupFade(nav.viewDistanceAu);`
  - `localGroup.object.visible = lgFade > 0;`
  - `localGroup.setOpacity(lgFade);`
  - `localGroup.setPosition(-nav.focusWorldAu[0], -nav.focusWorldAu[1], -nav.focusWorldAu[2]);`
  - `field.setOpacity(1 - lgFade);`（星野フェードアウト）
- ラベル（`labelItems` 構築、既存 galaxy/localgroup で星名は省略済み）: `lgFade > 0.5` のとき現在地マーカー（`text:'現在地（太陽系）'`, `worldPos: localGroup.markerWorldPos()`）と距離（`text:'約250万光年'`, `worldPos: localGroup.midpointWorldPos()`）を push。
- 既存の star/planet 選択・fade・scaleInfo/scaleBar/scalePanel 更新は不変。

## 受入基準（目視・コントローラ）

1. 銀河ビュー（galaxy 段）から更にズームアウトすると、近傍星野が滑らかに消え、**2つの渦巻き銀河**（天の川・アンドロメダ）が現れる。腕・バルジの渦巻き形状が分かる。
2. アンドロメダは天の川より大きく描かれ、離れた位置にある（大きさ・距離感が分かる）。天の川に「現在地（太陽系）」、両者の間に「約250万光年」ラベル。星名ラベルは出ない。
3. アンドロメダ方向へ前進（W）すると渦巻きが**大きく**見える（近づける）。ズームインすると銀河群が消え近傍星野へ戻る。
4. ドラッグ回転・ホイールズームが効き、クリックや既存パネルを妨げない。

## File Structure
```
src/galaxy/galaxyParams.ts          # 新規: 銀河パラメータ定数
src/galaxy/GalaxyDisk.ts            # 新規: buildGalaxyGeometry(純粋) + GalaxyDisk クラス
src/galaxy/galaxy.vert.glsl         # 新規
src/galaxy/galaxy.frag.glsl         # 新規
src/galaxy/LocalGroup.ts            # 新規: 天の川+アンドロメダ+現在地マーカー束ね
src/nav/localGroupFade.ts           # 新規（純粋）
src/starfield/StarField.ts          # 改修: uOpacity + setOpacity
src/starfield/starfield.frag.glsl   # 改修: alpha * uOpacity
src/app.ts                          # 改修: LocalGroup 結線・フェード・ラベル・旧模式図撤去
src/ui/LocalGroupDiagram.ts         # 削除
tests/galaxy/galaxyDisk.test.ts     # 新規
tests/galaxy/localGroup.test.ts     # 新規
tests/nav/localGroupFade.test.ts    # 新規
tests/starfield/starField.test.ts   # 追記: setOpacity が uniform 反映
```

## テスト
- `buildGalaxyGeometry`: 決定性（同 seed 同出力）、要素数（`count*3` / `count`）、全点が半径 `<= radiusAu*1.05`・厚み内、色成分 `[0,1]`、バルジ点が中心近傍。
- `localGroupFade`: 3e9→0、1e10→1、中間で単調増加（smoothstep）、clamp（0 以下 / 上限）。
- `LocalGroup`: object 構造（子＝2 GalaxyDisk + marker）、`setOpacity` が両 disk の uniform に反映、`markerWorldPos`/`midpointWorldPos` が `setPosition` を反映、`dispose`。
- `StarField.setOpacity`: uniform 反映（既存テストへ追記、既定 1.0 不変）。
- Playwright E2E: 受入基準 1〜4 を実機で確認（星野フェード→銀河出現→前進で拡大→ラベル→クリック非干渉）。
```
