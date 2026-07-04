export const PARSEC_IN_LY = 3.2615637769;
export const SUN_ABSMAG = 4.83;

export type SpectralClass = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M';

const CLASS_FLOORS: [number, SpectralClass][] = [
  [30000, 'O'], [10000, 'B'], [7500, 'A'], [6000, 'F'],
  [5200, 'G'], [3700, 'K'], [0, 'M'],
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
