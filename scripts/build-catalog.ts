import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { encodeCatalog, type StarColumns } from '../src/catalog/format';

const MAG_LIMIT = 7.5;

export function parseHygCsv(text: string): { columns: StarColumns; names: Record<number, string> } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0]!.split(',');
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`missing column: ${name}`);
    return i;
  };
  const iMag = col('mag'), iAbs = col('absmag'), iCi = col('ci');
  const iX = col('x'), iY = col('y'), iZ = col('z'), iProper = col('proper');

  const x: number[] = [], y: number[] = [], z: number[] = [];
  const mag: number[] = [], absmag: number[] = [], ci: number[] = [];
  const names: Record<number, string> = {};

  for (let r = 1; r < lines.length; r++) {
    const f = lines[r]!.split(',');
    const px = Number(f[iX]), py = Number(f[iY]), pz = Number(f[iZ]);
    const m = Number(f[iMag]);
    if (!Number.isFinite(px) || !Number.isFinite(py) || !Number.isFinite(pz)) continue;
    if (!Number.isFinite(m) || m > MAG_LIMIT) continue;
    const idx = x.length;
    x.push(px); y.push(py); z.push(pz);
    mag.push(m);
    absmag.push(Number(f[iAbs]) || 0);
    ci.push(Number(f[iCi]) || 0);
    const proper = (f[iProper] ?? '').trim();
    if (proper) names[idx] = proper;
  }

  const columns: StarColumns = {
    count: x.length,
    x: Float32Array.from(x), y: Float32Array.from(y), z: Float32Array.from(z),
    mag: Float32Array.from(mag), absmag: Float32Array.from(absmag), ci: Float32Array.from(ci),
  };
  return { columns, names };
}

function main() {
  const csv = readFileSync('data/hygdata_v3.csv', 'utf8');
  const { columns, names } = parseHygCsv(csv);
  mkdirSync('public/data', { recursive: true });
  const buffer = encodeCatalog(columns);
  writeFileSync('public/data/hyg.bin', Buffer.from(buffer));
  writeFileSync('public/data/hyg-names.json', JSON.stringify(names));
  console.log(`wrote ${columns.count} stars, ${Object.keys(names).length} named`);
}

// CLI 実行時のみ main を呼ぶ（テスト import 時は呼ばない）
if (process.argv[1] && process.argv[1].endsWith('build-catalog.ts')) main();
