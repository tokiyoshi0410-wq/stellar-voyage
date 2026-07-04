// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseHygCsv } from '../../scripts/build-catalog';

const csv = readFileSync(
  fileURLToPath(new URL('../../scripts/__fixtures__/sample-hyg.csv', import.meta.url)),
  'utf8',
);

const quotedCsv = readFileSync(
  fileURLToPath(new URL('../../scripts/__fixtures__/sample-hyg-quoted.csv', import.meta.url)),
  'utf8',
);

describe('parseHygCsv', () => {
  it('keeps only stars with mag <= 7.5', () => {
    const { columns } = parseHygCsv(csv);
    expect(columns.count).toBe(2); // id 3 (mag 8.2) is dropped
  });

  it('maps columns correctly', () => {
    const { columns } = parseHygCsv(csv);
    expect(columns.mag[0]).toBeCloseTo(-26.7, 3);
    expect(columns.x[1]).toBeCloseTo(-1.1, 3);
    expect(columns.ci[0]).toBeCloseTo(0.656, 3);
  });

  it('collects proper names keyed by output index', () => {
    const { names } = parseHygCsv(csv);
    expect(names[0]).toBe('Sol');
    expect(names[1]).toBe('Sirius');
    expect(names[2]).toBeUndefined();
  });
});

describe('parseHygCsv (real HYG format: quoted header + quoted commas)', () => {
  it('finds all columns even when the header row is fully double-quoted', () => {
    // Real HYG v41 header looks like "id","proper","mag",... — a naive
    // line.split(',') never matches header.indexOf('mag') since the cell
    // is literally `"mag"`, not `mag`. This must not throw.
    expect(() => parseHygCsv(quotedCsv)).not.toThrow();
  });

  it('keeps numeric columns aligned when a quoted text field contains a comma', () => {
    const { columns } = parseHygCsv(quotedCsv);
    expect(columns.count).toBe(1);
    expect(columns.mag[0]).toBeCloseTo(-26.7, 3);
    expect(columns.ci[0]).toBeCloseTo(0.656, 3);
    expect(columns.x[0]).toBeCloseTo(1.5, 3);
  });

  it('captures the quoted proper name with the embedded comma intact and quotes stripped', () => {
    const { names } = parseHygCsv(quotedCsv);
    expect(names[0]).toBe('Alpha, test');
  });
});

describe('parseHygCsv (escaped quotes and empty quoted fields)', () => {
  // header + 2 data rows built inline: an "extra" text column (not a
  // required field) sits between `proper` and the numeric columns so we can
  // verify neither an escaped quote nor an empty quoted field shifts the
  // numeric columns that follow it.
  const csv =
    '"id","proper","extra","mag","absmag","ci","x","y","z"\n' +
    '1,"She said ""hi""","note",-26.7,4.85,0.656,1.5,2.5,3.5\n' +
    '2,"Bar name","",-1.44,1.45,0.0,-1.1,-1.9,1.2\n';

  it('unescapes a doubled quote ("") inside a quoted field to a single literal quote', () => {
    const { names, columns } = parseHygCsv(csv);
    expect(names[0]).toBe('She said "hi"');
    expect(columns.mag[0]).toBeCloseTo(-26.7, 3);
  });

  it('parses an empty quoted field ("") in a non-required text column as an empty string, without shifting later numeric columns', () => {
    const { columns } = parseHygCsv(csv);
    // row 2's "extra" column is `""` (empty) — mag/x for row 2 must still
    // line up with the right cells, not be off by one.
    expect(columns.mag[1]).toBeCloseTo(-1.44, 3);
    expect(columns.x[1]).toBeCloseTo(-1.1, 3);
  });
});
