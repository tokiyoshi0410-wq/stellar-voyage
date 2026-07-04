# Stellar Voyage

実在の星カタログと手続き生成で宇宙を旅する Web シミュレータ（M1: 星空と飛行）。

## 開発

    npm install
    # HYG カタログ CSV を data/ に置く（下記）
    npm run build:catalog     # public/data/hyg.bin を生成
    npm run build:exoplanets  # public/data/exoplanets.json を生成（data/nasa-exoplanets.csv が必要。
                               # 未配置の場合、系外惑星は生成せず手続き生成の惑星にフォールバックする）
    npm run dev

## データ

- 星カタログ: HYG Database（astronexus/HYG-Database, CURRENT / v4.1）。`data/hygdata_v3.csv` に配置。
  ライセンス・クレジットは下記クレジット参照。

## テスト

    npm test

## 操作

- マウス: 視点（クリックでポインタロック）
- W / S: スロットル増減（0 → 0.999c → ワープ）
- クリック: 正面の星を選択して情報表示
- 「この星系へ」「系を出る」ボタンはクリックするために Esc でポインタロックを解除する必要がある

## クレジット

- HYG Database（astronexus/HYG-Database, CURRENT / v4.1）— © astronexus, HYG Database contributors, CC BY-SA 4.0
- 系外惑星データ — NASA Exoplanet Archive（自由利用可、出典明記）
