import { decodeCatalog, type StarColumns } from './format';

export class StarCatalog {
  constructor(
    readonly columns: StarColumns,
    readonly names: Record<number, string>,
  ) {}

  static fromData(columns: StarColumns, names: Record<number, string>): StarCatalog {
    return new StarCatalog(columns, names);
  }

  static async load(binUrl: string, namesUrl: string): Promise<StarCatalog> {
    const [binRes, namesRes] = await Promise.all([fetch(binUrl), fetch(namesUrl)]);
    if (!binRes.ok) throw new Error(`failed to load catalog: ${binRes.status}`);
    const buffer = await binRes.arrayBuffer();
    const columns = decodeCatalog(buffer);
    const names = namesRes.ok ? await namesRes.json() : {};
    return new StarCatalog(columns, names);
  }

  nameOf(index: number): string | null {
    return this.names[index] ?? null;
  }
}
