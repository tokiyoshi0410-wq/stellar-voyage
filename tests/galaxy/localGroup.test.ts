import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LocalGroup } from '../../src/galaxy/LocalGroup';

describe('LocalGroup', () => {
  it('contains two galaxy Points objects', () => {
    const lg = new LocalGroup();
    const points = lg.object.children.filter((c) => c.type === 'Points');
    expect(points.length).toBe(2);
    lg.dispose();
  });
  it('setOpacities sets the Milky Way group and Andromeda independently', () => {
    const lg = new LocalGroup();
    lg.setOpacities(0.3, 0.7);
    const points = lg.object.children.filter((c) => c.type === 'Points');
    const mwU = (points[0] as unknown as { material: { uniforms: { uOpacity: { value: number } } } })
      .material.uniforms.uOpacity.value;
    const andU = (points[1] as unknown as { material: { uniforms: { uOpacity: { value: number } } } })
      .material.uniforms.uOpacity.value;
    expect(mwU).toBe(0.3);   // children[0] = 天の川
    expect(andU).toBe(0.7);  // children[1] = アンドロメダ
    // 現在地マーカー(Mesh)と公転円(Line)は我々の銀河の要素なので天の川側に追従する。
    // マーカーは基準1.0でそのまま、公転円は基準0.5の半透明を保ったまま milkyWay で減衰する。
    let markerOpacity: number | undefined;
    let lineOpacity: number | undefined;
    lg.object.traverse((o) => {
      if (o.type === 'Mesh') markerOpacity = (o as unknown as { material: { opacity: number } }).material.opacity;
      if (o instanceof THREE.Line) lineOpacity = (o as unknown as { material: { opacity: number } }).material.opacity;
    });
    expect(markerOpacity).toBe(0.3);
    expect(lineOpacity).toBeCloseTo(0.15, 6); // 0.5(基準) × 0.3(milkyWay)
    lg.dispose();
  });
  it('centers Andromeda at the group origin (crossfade, not side-by-side)', () => {
    const lg = new LocalGroup();
    const points = lg.object.children.filter((c) => c.type === 'Points');
    const andCenter = new THREE.Vector3();
    points[1]!.getWorldPosition(andCenter); // children[1] = アンドロメダ
    expect(andCenter.length()).toBeLessThan(1e8); // 横オフセット撤去＝原点中心
    lg.dispose();
  });
  it('midpointWorldPos reflects setPosition', () => {
    const lg = new LocalGroup();
    const base = lg.midpointWorldPos();
    lg.setPosition(1000, 0, 0);
    const moved = lg.midpointWorldPos();
    expect(moved[0]).toBeCloseTo(base[0] + 1000, 0);
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
  it('puts the 現在地 marker at the group origin with the Milky Way center offset (no double Sun)', () => {
    const lg = new LocalGroup();
    const marker = lg.markerWorldPos();
    // Sun marker coincides with the focus/zoom-center (group origin)
    expect(Math.hypot(marker[0], marker[1], marker[2])).toBeCloseTo(0, 0);
    // ...while the Milky Way disk CENTER is offset from the Sun (Sun sits on an arm, not the core)
    const mwCenter = new THREE.Vector3();
    const points = lg.object.children.filter((c) => c.type === 'Points');
    points[0]!.getWorldPosition(mwCenter);
    expect(mwCenter.length()).toBeGreaterThan(1e8);
    lg.dispose();
  });
});

describe('LocalGroup galactic orbit', () => {
  it('has a Sun galactic-orbit circle line', () => {
    const lg = new LocalGroup();
    let lines = 0;
    lg.object.traverse((o) => { if (o instanceof THREE.Line) lines++; });
    expect(lines).toBeGreaterThan(0);
    lg.dispose();
  });
  it('update(t) rotates the Milky Way disk (galaxy spin)', () => {
    const lg = new LocalGroup();
    lg.update(0);
    const r0 = (lg.object.children[0] as THREE.Object3D).rotation.y; // children[0] = 天の川円盤
    lg.update(5);
    const r5 = (lg.object.children[0] as THREE.Object3D).rotation.y;
    expect(r5).not.toBe(r0);
    lg.dispose();
  });
  it('galacticCenterWorldPos is offset from the origin (Sun)', () => {
    const lg = new LocalGroup();
    const c = lg.galacticCenterWorldPos();
    expect(Math.hypot(c[0], c[1], c[2])).toBeGreaterThan(0);
    lg.dispose();
  });
});
