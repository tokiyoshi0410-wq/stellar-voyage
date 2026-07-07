import { AU_IN_OKUKM } from '../ui/format';

const LIGHT_MIN_PER_AU = 8.317;   // 1 AU を光が進む時間（分）
const NEPTUNE_ORBIT_AU = 30.1;    // 海王星の軌道長半径（solarSystem.ts と一致）
const SOLAR_MAX_AU = 30000;       // 太陽系ステージの上限（フェード帯の上端）
const GALAXY_MIN_AU = 1_000_000;  // 銀河ステージの下限
// 局部銀河群ステージの下限。localGroupFade の中点(=(3e9+1e10)/2=6.5e9, lgFade=0.5 の点)に
// 一致させ、概念ラベル(app.ts の lgFade>0.5)と縮尺バー非表示(stage==='localgroup')を同時化する
// （両者がズレると「約250万光年」概念ラベルと実スケール縮尺バーが同時表示され矛盾する）。
const LOCALGROUP_MIN_AU = 6.5e9;

export function formatLightTime(lightMinutes: number): string {
  // 総秒数から算出して単位境界の桁上がりを正しく扱う（0.999分→"1分" 等）。
  const totalSec = Math.round(lightMinutes * 60);
  if (totalSec < 60) return `${totalSec}秒`;
  if (totalSec < 3600) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return s > 0 ? `${m}分${s}秒` : `${m}分`;
  }
  const min = totalSec / 60;
  if (min < 60 * 24) return `約${Math.round(min / 60)}時間`;
  if (min < 60 * 24 * 365) return `約${Math.round(min / 60 / 24)}日`;
  // 100年未満は有効数字2桁（"4.2年"）、以上は整数丸め＋桁区切り（toPrecision の指数表記 "1.5e+2" を回避）
  const yr = min / 60 / 24 / 365;
  return `約${yr < 100 ? Number(yr.toPrecision(2)) : Math.round(yr).toLocaleString('ja-JP')}年`;
}

export interface ScaleInfo {
  stage: 'solar' | 'interstellar' | 'galaxy' | 'localgroup';
  title: string;
  lines: string[];
}

export function scaleInfoFor(viewDistanceAu: number): ScaleInfo {
  if (viewDistanceAu >= LOCALGROUP_MIN_AU) {
    return {
      stage: 'localgroup',
      title: '局部銀河群',
      lines: [
        '銀河が 約50個 集まった なかま',
        '天の川銀河とアンドロメダ銀河は 約250万光年',
        '光でも 250万年 かかる きょり',
      ],
    };
  }
  if (viewDistanceAu >= GALAXY_MIN_AU) {
    return {
      stage: 'galaxy',
      title: '天の川銀河',
      lines: ['星の数 約2000億個', '端から端 約10万光年（光でも10万年）', '太陽もこの中のひとつ'],
    };
  }
  if (viewDistanceAu >= SOLAR_MAX_AU) {
    return {
      stage: 'interstellar',
      title: '太陽系の外へ',
      lines: ['太陽系はこんなに小さい！', 'いちばん近い星まで 光で 約4.2年', '光は1秒で地球を7周半'],
    };
  }
  const edgeAu = NEPTUNE_ORBIT_AU * 2; // 端から端＝海王星軌道の直径
  const edgeOkm = Math.round(edgeAu * AU_IN_OKUKM);
  return {
    stage: 'solar',
    title: '太陽系',
    lines: [
      `端から端: 約${edgeOkm}億km（海王星の軌道）`,
      `光でも 端から端まで ${formatLightTime(edgeAu * LIGHT_MIN_PER_AU)}`,
      `地球から太陽まで 光で ${formatLightTime(1.0 * LIGHT_MIN_PER_AU)}`,
    ],
  };
}
