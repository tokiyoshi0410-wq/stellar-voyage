import { AU_IN_OKUKM } from '../ui/format';

const LIGHT_MIN_PER_AU = 8.317;   // 1 AU を光が進む時間（分）
const NEPTUNE_ORBIT_AU = 30.1;    // 海王星の軌道長半径（solarSystem.ts と一致）
const SOLAR_MAX_AU = 30000;       // 太陽系ステージの上限（フェード帯の上端）
const GALAXY_MIN_AU = 1_000_000;  // 銀河ステージの下限

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
  return `約${(min / 60 / 24 / 365).toPrecision(2)}年`;
}

export interface ScaleInfo {
  stage: 'solar' | 'interstellar' | 'galaxy';
  title: string;
  lines: string[];
}

export function scaleInfoFor(viewDistanceAu: number): ScaleInfo {
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
