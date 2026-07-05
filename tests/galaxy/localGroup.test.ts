import { describe, it, expect } from 'vitest';
import { LocalGroup } from '../../src/galaxy/LocalGroup';
import { ANDROMEDA_OFFSET_AU } from '../../src/galaxy/galaxyParams';

describe('LocalGroup', () => {
  it('contains two galaxy Points objects', () => {
    const lg = new LocalGroup();
    const points = lg.object.children.filter((c) => c.type === 'Points');
    expect(points.length).toBe(2);
    lg.dispose();
  });
  it('setOpacity propagates to both disks', () => {
    const lg = new LocalGroup();
    lg.setOpacity(0.4);
    for (const c of lg.object.children) {
      const m = (c as { material?: { uniforms?: { uOpacity?: { value: number } } } }).material;
      if (m?.uniforms?.uOpacity) expect(m.uniforms.uOpacity.value).toBe(0.4);
    }
    let markerOpacity: number | undefined;
    lg.object.traverse((o) => {
      if (o.type === 'Mesh') {
        markerOpacity = (o as unknown as { material: { opacity: number } }).material.opacity;
      }
    });
    expect(markerOpacity).toBe(0.4);
    lg.dispose();
  });
  it('midpointWorldPos reflects setPosition', () => {
    const lg = new LocalGroup();
    lg.setPosition(1000, 0, 0);
    const mid = lg.midpointWorldPos();
    expect(mid[0]).toBeCloseTo(ANDROMEDA_OFFSET_AU / 2 + 1000, 0);
    lg.dispose();
  });
  it('markerWorldPos shifts by setPosition delta', () => {
    const a = new LocalGroup();
    const base = a.markerWorldPos();
    a.setPosition(500, 0, 0);
    const moved = a.markerWorldPos();
    expect(moved[0]).toBeCloseTo(base[0] + 500, 0);
    a.dispose();
  });
});
