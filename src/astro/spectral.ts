export const PARSEC_IN_LY = 3.2615637769;
export const SUN_ABSMAG = 4.83;

export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

// 温度境界は色温度式 bvToTemperature(Ballesteros) の出力に合わせて Harvard 分類の B-V 境界を
// 変換した値。素朴な等間隔境界だと Ballesteros が高温側で 10,100K 付近を返すため、B-V≈0 の
// A 型星（シリウス/ベガ）が B に転がり落ちていた。各値は Harvard の B-V 境界を式に通した近似。
const CLASS_FLOORS: [number, SpectralClass][] = [
  [16600, 'O'], [10380, 'B'], [7460, 'A'], [6050, 'F'],
  [5250, 'G'], [3950, 'K'], [0, 'M'],
];

export function temperatureToSpectralClass(kelvin: number): SpectralClass {
  for (const [floor, cls] of CLASS_FLOORS) if (kelvin >= floor) return cls;
  return 'M';
}

export function parsecsToLightYears(pc: number): number {
  return pc * PARSEC_IN_LY;
}

// bolometric 補正を無視した近似（視覚等級ベース）
export function absMagToLuminosity(absmag: number): number {
  return Math.pow(10, (SUN_ABSMAG - absmag) / 2.5);
}
