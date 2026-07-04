# Stellar Voyage

実在の星カタログと手続き生成で宇宙を旅する Web シミュレータ（M1: 星空と飛行）。

## 開発

    npm install
    # HYG カタログ CSV を data/ に置く（下記）
    npm run build:catalog   # public/data/hyg.bin を生成
    npm run dev

## データ

- 星カタログ: HYG Database v3（astronexus/HYG-Database）。`data/hygdata_v3.csv` に配置。
  ライセンス CC BY-SA 4.0。© astronexus, HYG Database contributors.

## テスト

    npm test

## 操作

- マウス: 視点（クリックでポインタロック）
- W / S: スロットル増減（0 → 0.999c → ワープ）
- クリック: 正面の星を選択して情報表示

## クレジット

- HYG Database v3 — © astronexus, HYG Database contributors, CC BY-SA 4.0
- 系外惑星データ（M2 以降）— NASA Exoplanet Archive
