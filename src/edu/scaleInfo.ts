import { AU_IN_OKUKM } from '../ui/format';

const LIGHT_MIN_PER_AU = 8.317;   // 1 AU を光が進む時間（分）
const NEPTUNE_ORBIT_AU = 30.1;    // 海王星の軌道長半径（solarSystem.ts と一致）
const SOLAR_MAX_AU = 30000;       // 太陽系ステージの上限（フェード帯の上端）
export const GALAXY_MIN_AU = 1_000_000;  // 銀河ステージの下限
// 銀河団ステージの下限。天の川が小さくなり、周囲の銀河（大規模構造）が主役になり始める点。
export const CLUSTER_MIN_AU = 3e10;
// 超銀河団ステージの下限。多数の銀河団が網目状につながって見えてくる点。
export const SUPERCLUSTER_MIN_AU = 1.5e11;
// 観測可能な宇宙ステージの下限。大規模構造を宇宙の地平線（CMB 球殻）が包む終着点。
export const UNIVERSE_MIN_AU = 1.5e12;

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
  stage: 'solar' | 'interstellar' | 'galaxy' | 'cluster' | 'supercluster' | 'universe';
  title: string;
  lines: string[];
}

export function scaleInfoFor(viewDistanceAu: number): ScaleInfo {
  if (viewDistanceAu >= UNIVERSE_MIN_AU) {
    return {
      stage: 'universe',
      title: '観測可能な宇宙',
      lines: [
        '見わたせる かぎりの 宇宙ぜんぶ',
        '端から端 約930億光年',
        'これより遠くは 光が届かない（宇宙の地平線）',
      ],
    };
  }
  if (viewDistanceAu >= SUPERCLUSTER_MIN_AU) {
    return {
      stage: 'supercluster',
      title: '超銀河団',
      lines: [
        '銀河団が さらに 集まった 宇宙の大構造',
        '網目のように つながって 数万個の銀河',
        '天の川銀河は その中の ひとつの点',
      ],
    };
  }
  if (viewDistanceAu >= CLUSTER_MIN_AU) {
    return {
      stage: 'cluster',
      title: '銀河団',
      lines: [
        '銀河が 数百〜数千個 集まった なかま',
        'ひとつひとつの光の点が 銀河（星が数千億個）',
        '天の川銀河も その中の ひとつ',
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
      lines: [
        '太陽系はこんなに小さい！',
        'まわりの光の点は ぜんぶ 恒星（太陽の仲間）',
        'いちばん近い星でも 光で 約4.2年',
        '天の川銀河には こんな星が 約2000億個',
      ],
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
