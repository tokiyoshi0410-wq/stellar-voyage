import { describe, it, expect } from 'vitest';
import { joinExoplanets } from '../../scripts/build-exoplanets';
import type { StarIds } from '../../scripts/build-catalog';

const ids: StarIds[] = [
  { hd: '48915', hip: '32349', gl: 'Gl 244A', proper: 'Sirius' }, // index 0
  { hd: '', hip: '', gl: '', proper: 'Sol' },                     // index 1
];

describe('joinExoplanets', () => {
  it('joins a NASA row to the star index by HD id', () => {
    const rows = [{ hostname: 'Sirius', hostHd: '48915', hostHip: '', hostGl: '', plName: 'Sirius b', smaxAu: 2.0, radiusEarth: 5, massEarth: 20, eqTempK: 400 }];
    const map = joinExoplanets(ids, rows);
    expect(map[0]).toBeDefined();
    expect(map[0]!.length).toBe(1);
    expect(map[0]![0]!.isReal).toBe(true);
    expect(map[0]![0]!.semiMajorAxisAu).toBe(2.0);
    expect(map[1]).toBeUndefined();
  });
  it('falls back to proper-name match when ids empty', () => {
    const rows = [{ hostname: 'Sol', hostHd: '', hostHip: '', hostGl: '', plName: 'Sol c', smaxAu: 1.0, radiusEarth: 1, massEarth: 1, eqTempK: 288 }];
    const map = joinExoplanets(ids, rows);
    expect(map[1]).toBeDefined();
    expect(map[1]![0]!.name).toBe('Sol c');
  });
  it('marks estimated when radius/mass missing', () => {
    const rows = [{ hostname: 'Sirius', hostHd: '48915', hostHip: '', hostGl: '', plName: 'Sirius b', smaxAu: 2.0, radiusEarth: null, massEarth: null, eqTempK: null }];
    const map = joinExoplanets(ids, rows);
    expect(map[0]![0]!.estimated).toBe(true);
    expect(map[0]![0]!.radiusEarth).toBeGreaterThan(0); // filled with a default
  });
  it('drops planets with missing semi-major axis instead of fabricating 1.0 AU', () => {
    // 軌道長半径が無い惑星は軌道リング/公転/HZ を正しく描けない。1.0 AU をでっち上げると
    // 実在バッジ付きで誤った「ハビタブルゾーン内」を表示しうるため、除外する。
    const rows = [{ hostname: 'Sirius', hostHd: '48915', hostHip: '', hostGl: '', plName: 'Sirius b', smaxAu: null, radiusEarth: 5, massEarth: 20, eqTempK: 400 }];
    const map = joinExoplanets(ids, rows);
    expect(map[0]).toBeUndefined();
  });
});
