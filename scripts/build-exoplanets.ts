import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseHygCsv, parseCsvLine, type StarIds } from './build-catalog';
import type { Planet, PlanetType } from '../src/system/types';

export interface NasaRow {
  hostname: string; hostHd: string; hostHip: string; hostGl: string;
  plName: string; smaxAu: number | null; radiusEarth: number | null;
  massEarth: number | null; eqTempK: number | null;
}

// 半径から型を推定（詳細な判定は生成側に任せ、実データは簡易分類）
function inferType(radiusEarth: number): PlanetType {
  if (radiusEarth >= 6) return 'gas';
  if (radiusEarth >= 2.5) return 'ice';
  return 'rock';
}

export function joinExoplanets(ids: StarIds[], nasaRows: NasaRow[]): Record<number, Planet[]> {
  const byHd = new Map<string, number>(), byHip = new Map<string, number>(),
    byGl = new Map<string, number>(), byProper = new Map<string, number>();
  ids.forEach((id, i) => {
    if (id.hd) byHd.set(id.hd, i);
    if (id.hip) byHip.set(id.hip, i);
    if (id.gl) byGl.set(id.gl, i);
    if (id.proper) byProper.set(id.proper, i);
  });
  const out: Record<number, Planet[]> = {};
  for (const r of nasaRows) {
    let idx: number | undefined;
    if (r.hostHd && byHd.has(r.hostHd)) idx = byHd.get(r.hostHd);
    else if (r.hostHip && byHip.has(r.hostHip)) idx = byHip.get(r.hostHip);
    else if (r.hostGl && byGl.has(r.hostGl)) idx = byGl.get(r.hostGl);
    else if (r.hostname && byProper.has(r.hostname)) idx = byProper.get(r.hostname);
    if (idx == null) continue;
    // 軌道長半径が無い/非正の惑星は軌道リング/公転/HZ を正しく描けない。1.0 AU を捏造すると
    // 実在バッジ付きで誤った「ハビタブルゾーン内」を表示しうるため、除外する（a<=0 は原点固定・
    // RingGeometry 内径が負になる不正データ）。
    if (r.smaxAu == null || r.smaxAu <= 0) continue;
    const estimated = r.radiusEarth == null || r.massEarth == null;
    const radiusEarth = r.radiusEarth ?? 1.0;
    const massEarth = r.massEarth ?? Math.pow(radiusEarth, 3);
    const planet: Planet = {
      name: r.plName,
      type: inferType(radiusEarth),
      semiMajorAxisAu: r.smaxAu,
      radiusEarth,
      massEarth,
      eqTempK: r.eqTempK,
      inHabitableZone: false, // プレースホルダー。実際の判定は buildStellarSystem が実行時に光度・軌道から再計算して上書きする
      isReal: true,
      estimated,
    };
    (out[idx] ??= []).push(planet);
  }
  return out;
}

// CLI: NASA CSV（ローカル data/nasa-exoplanets.csv）を読み、HYG と突合して JSON 出力
function parseNasaCsv(text: string): NasaRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0 && !l.startsWith('#'));
  // 列にカンマを含むクオート付きフィールド（惑星名・別名等）で列がずれないよう、
  // build-catalog と同じクオート対応パーサーを使う（素朴な split(',') は非対称で地雷）。
  const header = parseCsvLine(lines[0]!);
  const col = (n: string) => header.indexOf(n);
  const iHost = col('hostname'), iHd = col('hd'), iHip = col('hip'), iGl = col('gl'),
    iPl = col('pl_name'), iSma = col('pl_orbsmax'), iRad = col('pl_rade'),
    iMass = col('pl_bmasse'), iTeq = col('pl_eqt');
  const num = (v: string | undefined) => { const n = Number(v); return v && Number.isFinite(n) ? n : null; };
  const rows: NasaRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]!);
    rows.push({
      hostname: (f[iHost] ?? '').trim(),
      hostHd: iHd >= 0 ? (f[iHd] ?? '').trim() : '',
      hostHip: iHip >= 0 ? (f[iHip] ?? '').trim() : '',
      hostGl: iGl >= 0 ? (f[iGl] ?? '').trim() : '',
      plName: (f[iPl] ?? '').trim(),
      smaxAu: num(f[iSma]), radiusEarth: num(f[iRad]), massEarth: num(f[iMass]), eqTempK: num(f[iTeq]),
    });
  }
  return rows;
}

function main(): void {
  const { ids } = parseHygCsv(readFileSync('data/hygdata_v3.csv', 'utf8'));
  const rows = parseNasaCsv(readFileSync('data/nasa-exoplanets.csv', 'utf8'));
  const map = joinExoplanets(ids, rows);
  mkdirSync('public/data', { recursive: true });
  writeFileSync('public/data/exoplanets.json', JSON.stringify(map));
  console.log(`joined ${Object.keys(map).length} systems from ${rows.length} NASA rows`);
}

if (process.argv[1] && process.argv[1].endsWith('build-exoplanets.ts')) main();
