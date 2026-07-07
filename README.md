# Stellar Voyage

実在の星カタログ（HYG）と NASA 系外惑星データ、手続き生成で宇宙を旅するブラウザ・シミュレータ。
太陽系を斜め上から見下ろす視点で始まり、連続ズームで恒星系 → 近傍星野 → 天の川銀河 →
局部銀河群（アンドロメダ）までシームレスに縮尺が変わる。Vite + TypeScript + Three.js。

## 操作

- **ドラッグ**: 視点を周回
- **ホイール**: ズームイン / アウト（太陽系 ⇔ 銀河スケールを連続で行き来）
- **WASD**: 移動（画面下の速度スライダーで速さを調整）
- **クリック**: 星 / 惑星を選択して日本語の情報パネルを表示
- **⏸ 停止 / Space**: 公転・自転アニメーションを一時停止
- **💡 光を放つ**: 画面上部の「光速バー」で地球→海王星へ光が進む様子を実光速で見せる

ズームアウトすると恒星系ビューがフェードして近傍星野へ、さらに進むと天の川銀河、
最後に局部銀河群（天の川⇔アンドロメダのクロスフェード）へと縮尺が切り替わる。
左上の教育パネル・左下の縮尺バー・天体の直径定規がスケールに追従する。

## 開発

    npm install
    # 下記データ CSV を data/ に配置してから：
    npm run build:catalog     # public/data/hyg.bin（星カタログ）を生成
    npm run build:exoplanets  # public/data/exoplanets.json（系外惑星）を生成
    npm run dev               # http://localhost:5180 前後（使用中なら自動で次のポート）

`public/data/*` は生成物（gitignore 済み）。一度生成すれば `npm run dev` はそのまま動く。

## データ

- 星カタログ: HYG Database（astronexus/HYG-Database）。`data/hygdata_v3.csv` に配置。
- 系外惑星: NASA Exoplanet Archive の CSV を `data/nasa-exoplanets.csv` に配置
  （未配置なら系外惑星は結合されず、手続き生成の惑星のみになる）。

## テスト / 型チェック

    npm test            # vitest
    npx tsc --noEmit    # 型チェック

## クレジット

- HYG Database（astronexus/HYG-Database）— © astronexus, HYG Database contributors, CC BY-SA 4.0
- 系外惑星データ — NASA Exoplanet Archive（自由利用可、出典明記）
