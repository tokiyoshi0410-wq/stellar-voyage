import { AU_IN_OKUKM } from '../ui/format';

const AU_PER_LY = 63241.077;
const LIGHT_MIN_PER_AU = 8.317;
const TARGET_PX = 160;

export function niceRound(x: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const m = x / p;
  const nice = m >= 5 ? 5 : m >= 2 ? 2 : 1;
  return nice * p;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('ja-JP') : String(n);
}

// 縮尺バー用の光の到達時間（分を優先。小学生向けに「83分」等を保つ）。
function lightTimeShort(au: number): string {
  const min = au * LIGHT_MIN_PER_AU;
  if (min < 90) return `${Math.round(min)}分`;
  const hours = min / 60;
  if (hours < 48) return `約${Math.round(hours)}時間`;
  return `約${Math.round(hours / 24)}日`;
}

export function scaleBarFor(
  viewDistanceAu: number,
  screenHeightPx: number,
  fovYRad: number,
): { label: string; widthPx: number } {
  const worldHeightAu = 2 * viewDistanceAu * Math.tan(fovYRad / 2);
  const pxPerAu = screenHeightPx / worldHeightAu;
  const rawAu = TARGET_PX / pxPerAu;
  if (rawAu < 6000) {
    const niceAu = niceRound(rawAu);
    // toPrecision(2) は3桁以上で指数表記になる（"1.5e+2"）。固定表記に戻す（小学生向け）。
    const okm = Number((niceAu * AU_IN_OKUKM).toPrecision(2)).toLocaleString('ja-JP');
    return {
      label: `${fmtNum(niceAu)} AU ≈ ${okm}億km（光で ${lightTimeShort(niceAu)}）`,
      widthPx: niceAu * pxPerAu,
    };
  }
  const ly = rawAu / AU_PER_LY;
  if (ly < 10000) {
    const niceLy = niceRound(ly);
    return { label: `${fmtNum(niceLy)} 光年`, widthPx: niceLy * AU_PER_LY * pxPerAu };
  }
  const niceWan = niceRound(ly / 10000);
  return { label: `${fmtNum(niceWan)}万光年`, widthPx: niceWan * 10000 * AU_PER_LY * pxPerAu };
}
