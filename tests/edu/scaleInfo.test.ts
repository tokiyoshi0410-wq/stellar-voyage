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
  it('formats multi-century years without exponential notation', () => {
    const minFor150yr = 150 * 365 * 24 * 60; // 旧 toPrecision(2) は "約1.5e+2年"
    expect(formatLightTime(minFor150yr)).toBe('約150年');
    expect(formatLightTime(minFor150yr)).not.toMatch(/e\+/);
  });
  it('keeps sub-century years with one significant decimal', () => {
    const minFor4_2yr = 4.24 * 365 * 24 * 60;
    expect(formatLightTime(minFor4_2yr)).toMatch(/約4\.2年/);
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
  it('interstellar explains the surrounding stars (count + nearest-star distance); galaxy cites 10万光年', () => {
    const lines = scaleInfoFor(100000).lines.join(' ');
    expect(lines).toMatch(/恒星/);       // まわりの光の点は恒星
    expect(lines).toMatch(/約2000億/);   // 天の川の星の数（何千億個）
    expect(lines).toMatch(/約4\.2年/);   // いちばん近い星まで
    expect(scaleInfoFor(2_000_000).lines.join(' ')).toMatch(/10万光年/);
  });
});

describe('scaleInfoFor large-scale structure', () => {
  it('progresses galaxy → cluster → supercluster → universe as you zoom out', () => {
    expect(scaleInfoFor(1e10).stage).toBe('galaxy');       // まだ天の川ひとつ
    const cluster = scaleInfoFor(5e10);
    expect(cluster.stage).toBe('cluster');
    expect(cluster.title).toBe('銀河団');
    expect(cluster.lines.join(' ')).toMatch(/銀河/);
    const superc = scaleInfoFor(2e11);
    expect(superc.stage).toBe('supercluster');
    expect(superc.title).toBe('超銀河団');
    const universe = scaleInfoFor(3e12);
    expect(universe.stage).toBe('universe');
    expect(universe.title).toBe('観測可能な宇宙');
    expect(universe.lines.join(' ')).toMatch(/930億光年/);
  });
  it('has clean stage boundaries at CLUSTER (3e10), SUPERCLUSTER (1.5e11), UNIVERSE (1.5e12)', () => {
    expect(scaleInfoFor(3e10 - 1).stage).toBe('galaxy');
    expect(scaleInfoFor(3e10).stage).toBe('cluster');
    expect(scaleInfoFor(1.5e11 - 1).stage).toBe('cluster');
    expect(scaleInfoFor(1.5e11).stage).toBe('supercluster');
    expect(scaleInfoFor(1.5e12 - 1).stage).toBe('supercluster');
    expect(scaleInfoFor(1.5e12).stage).toBe('universe');
  });
  it('no longer mentions Andromeda anywhere', () => {
    for (const v of [1e10, 5e10, 2e11]) {
      expect(scaleInfoFor(v).lines.join(' ')).not.toMatch(/アンドロメダ/);
      expect(scaleInfoFor(v).title).not.toMatch(/アンドロメダ|局部銀河群/);
    }
  });
});
