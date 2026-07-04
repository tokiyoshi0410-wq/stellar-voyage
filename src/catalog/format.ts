export const MAGIC = 0x53564859; // 'SVHY' little-endian
export const VERSION = 1;

const COLUMNS = ['x', 'y', 'z', 'mag', 'absmag', 'ci'] as const;
const HEADER_BYTES = 12; // magic(4) + version(4) + count(4)

export interface StarColumns {
  count: number;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  mag: Float32Array;
  absmag: Float32Array;
  ci: Float32Array;
}

export function encodeCatalog(cols: StarColumns): ArrayBuffer {
  const { count } = cols;
  const buffer = new ArrayBuffer(HEADER_BYTES + COLUMNS.length * count * 4);
  const view = new DataView(buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint32(4, VERSION, true);
  view.setUint32(8, count, true);
  let offset = HEADER_BYTES;
  for (const name of COLUMNS) {
    new Float32Array(buffer, offset, count).set(cols[name]);
    offset += count * 4;
  }
  return buffer;
}

export function decodeCatalog(buffer: ArrayBuffer): StarColumns {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== MAGIC) throw new Error('bad magic in catalog');
  if (view.getUint32(4, true) !== VERSION) throw new Error('unsupported catalog version');
  const count = view.getUint32(8, true);
  const out: Record<string, unknown> = { count };
  let offset = HEADER_BYTES;
  for (const name of COLUMNS) {
    out[name] = new Float32Array(buffer.slice(offset, offset + count * 4));
    offset += count * 4;
  }
  return out as unknown as StarColumns;
}
