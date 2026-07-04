import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { encodeCatalog, type StarColumns } from '../src/catalog/format';

const MAG_LIMIT = 7.5;

// HYG カタログの CSV はヘッダーが全列ダブルクオート ("id","hip",...) で、
// bf/gl 等のテキスト列にカンマを含む場合がある。素朴な split(',') では
// ヘッダーの indexOf が一致せず、カンマ入りフィールドで列がずれるため、
// クオートを考慮した行パーサーを使う。
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        fields.push(field);
        field = '';
      } else {
        field += c;
      }
    }
  }
  fields.push(field);
  return fields;
}

export interface StarIds { hd: string; hip: string; gl: string; proper: string }

export function parseHygCsv(
  text: string,
): { columns: StarColumns; names: Record<number, string>; ids: StarIds[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const header = parseCsvLine(lines[0]!);
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`missing column: ${name}`);
    return i;
  };
  const iMag = col('mag'), iAbs = col('absmag'), iCi = col('ci');
  const iX = col('x'), iY = col('y'), iZ = col('z'), iProper = col('proper');
  // hd/hip/gl are optional columns (not present in every HYG export/fixture):
  // allow -1 and treat as always-empty rather than throwing.
  const iHd = header.indexOf('hd'), iHip = header.indexOf('hip'), iGl = header.indexOf('gl');
  const cell = (f: string[], i: number) => (i >= 0 ? (f[i] ?? '').trim() : '');

  const x: number[] = [], y: number[] = [], z: number[] = [];
  const mag: number[] = [], absmag: number[] = [], ci: number[] = [];
  const names: Record<number, string> = {};
  const ids: StarIds[] = [];

  for (let r = 1; r < lines.length; r++) {
    const f = parseCsvLine(lines[r]!);
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
    ids.push({ hd: cell(f, iHd), hip: cell(f, iHip), gl: cell(f, iGl), proper });
  }

  const columns: StarColumns = {
    count: x.length,
    x: Float32Array.from(x), y: Float32Array.from(y), z: Float32Array.from(z),
    mag: Float32Array.from(mag), absmag: Float32Array.from(absmag), ci: Float32Array.from(ci),
  };
  return { columns, names, ids };
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
