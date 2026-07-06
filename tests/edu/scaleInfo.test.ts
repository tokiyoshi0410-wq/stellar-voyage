import { describe, it, expect } from 'vitest';
import { formatLightTime, scaleInfoFor } from '../../src/edu/scaleInfo';

describe('formatLightTime', () => {
  it('formats the Earth–Sun light time as 8分19秒', () => {
    expect(formatLightTime(8.317)).toBe('8分19秒');
  });
  it('handles seconds, hours and years ranges', () => {
    expect(formatLightTime(0.5)).toBe('30秒');
    expect(formatLightTime(500)).toBe('約8時間');
    expect(formatLightTime(60 * 24 * 400)).toMatch(/約.*年/);
  });
  it('carries rounding up to the next unit (no "60秒" / "分60秒")', () => {
    expect(formatLightTime(0.999)).toBe('1分');
    expect(formatLightTime(8.995)).toBe('9分');
  });
});

describe('scaleInfoFor', () => {
  it('is the solar stage below 30000 AU with edge-to-edge facts', () => {
    const info = scaleInfoFor(40);
    expect(info.stage).toBe('solar');
    expect(info.title).toBe('太陽系');
    const joined = info.lines.join(' ');
    expect(joined).toMatch(/90億km/);
    expect(joined).toMatch(/約8時間/);
    expect(joined).toMatch(/8分19秒/);
  });
  it('switches solar→interstellar at 30000 AU and →galaxy at 1e6 AU', () => {
    expect(scaleInfoFor(29999).stage).toBe('solar');
    expect(scaleInfoFor(30000).stage).toBe('interstellar');
    expect(scaleInfoFor(1_000_000).stage).toBe('galaxy');
  });
  it('interstellar cites the nearest star in light-years; galaxy cites 10万光年', () => {
    expect(scaleInfoFor(100000).lines.join(' ')).toMatch(/約4\.2年/);
    expect(scaleInfoFor(2_000_000).lines.join(' ')).toMatch(/10万光年/);
  });
});

describe('scaleInfoFor local group', () => {
  it('is galaxy below the localgroup boundary and localgroup above it, mentioning Andromeda', () => {
    expect(scaleInfoFor(5e9).stage).toBe('galaxy');
    const info = scaleInfoFor(1e10);
    expect(info.stage).toBe('localgroup');
    expect(info.title).toBe('局部銀河群');
    expect(info.lines.join(' ')).toMatch(/250万光年/);
  });
  // 局部銀河群の概念ラベル(app.ts の lgFade>0.5)と縮尺バー非表示(stage==='localgroup')が
  // 同じ視距離で切り替わるよう、localgroup 境界を localGroupFade の中点(=(3e9+1e10)/2=6.5e9)に合わせる。
  it('enters localgroup exactly at the localGroupFade midpoint (6.5e9)', () => {
    expect(scaleInfoFor(6.5e9).stage).toBe('localgroup');
    expect(scaleInfoFor(6.5e9 - 1).stage).toBe('galaxy');
  });
});
