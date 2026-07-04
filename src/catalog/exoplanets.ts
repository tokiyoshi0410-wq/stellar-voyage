import type { Planet } from '../system/types';

export async function loadExoplanets(url: string): Promise<Record<number, Planet[]>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    return (await res.json()) as Record<number, Planet[]>;
  } catch {
    return {};
  }
}
