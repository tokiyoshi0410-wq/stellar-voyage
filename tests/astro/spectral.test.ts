import { describe, it, expect } from 'vitest';
import {
  temperatureToSpectralClass, parsecsToLightYears, absMagToLuminosity, PARSEC_IN_LY,
} from '../../src/astro/spectral';
import { bvToTemperature } from '../../src/astro/color';

describe('spectral', () => {
  it('classifies by temperature', () => {
    expect(temperatureToSpectralClass(40000)).toBe('O');
    expect(temperatureToSpectralClass(5800)).toBe('G');
    expect(temperatureToSpectralClass(3000)).toBe('M');
  });

  // クラス境界は色温度式(Ballesteros)の出力に合わせる。有名な A 型星(シリウス/ベガ, B-V≈0)が
  // 「B」に転がり落ちないよう B 境界を引き上げる。最頻クリック対象の誤分類を防ぐ回帰テスト。
  it('classifies famous stars from their B-V color (Sirius/Vega=A, Rigel=B, Sun=G)', () => {
    expect(temperatureToSpectralClass(bvToTemperature(0.00))).toBe('A');  // シリウス A1V / ベガ A0V
    expect(temperatureToSpectralClass(bvToTemperature(-0.03))).toBe('B'); // リゲル B8
    expect(temperatureToSpectralClass(bvToTemperature(0.65))).toBe('G');  // 太陽
  });

  it('converts parsecs to light years', () => {
    expect(parsecsToLightYears(1)).toBeCloseTo(PARSEC_IN_LY, 6);
    expect(parsecsToLightYears(10)).toBeCloseTo(32.615637, 4);
  });

  it('sun (absmag 4.83) has luminosity ~1', () => {
    expect(absMagToLuminosity(4.83)).toBeCloseTo(1, 3);
  });

  it('brighter absolute magnitude means higher luminosity', () => {
    expect(absMagToLuminosity(0)).toBeGreaterThan(absMagToLuminosity(5));
  });
});
