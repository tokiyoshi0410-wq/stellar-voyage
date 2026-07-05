import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildStarGeometry, StarField } from '../../src/starfield/StarField';
import type { StarColumns } from '../../src/catalog/format';

const columns = {
  count: 2,
  x: new Float32Array([0, 10]), y: new Float32Array([0, 0]), z: new Float32Array([0, 0]),
  mag: new Float32Array([-1.0, 6.0]), absmag: new Float32Array([1, 5]),
  ci: new Float32Array([-0.3, 1.5]),
};

function tinyColumns(n: number): StarColumns {
  return {
    count: n,
    x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n),
    mag: new Float32Array(n), absmag: new Float32Array(n), ci: new Float32Array(n),
  };
}

describe('buildStarGeometry', () => {
  it('produces one entry per star', () => {
    const g = buildStarGeometry(columns);
    expect(g.positions.length).toBe(6); // 2 stars * 3
    expect(g.colors.length).toBe(6);
    expect(g.sizes.length).toBe(2);
  });

  it('bright star is larger than faint star', () => {
    const g = buildStarGeometry(columns);
    expect(g.sizes[0]).toBeGreaterThan(g.sizes[1]!);
  });

  it('sizes are clamped into [0.5, 12]', () => {
    const g = buildStarGeometry(columns);
    for (const s of g.sizes) { expect(s).toBeGreaterThanOrEqual(0.5); expect(s).toBeLessThanOrEqual(12); }
  });

  it('hot blue star has more blue than red star', () => {
    const g = buildStarGeometry(columns);
    expect(g.colors[2]).toBeGreaterThan(g.colors[5]!); // star0 blue > star1 blue
  });
});

describe('StarField.setOpacity', () => {
  it('defaults uOpacity to 1.0 and setOpacity updates it', () => {
    const f = new StarField(tinyColumns(3));
    const mat = f.object.material as THREE.ShaderMaterial;
    expect(mat.uniforms.uOpacity!.value).toBe(1.0);
    f.setOpacity(0.25);
    expect(mat.uniforms.uOpacity!.value).toBe(0.25);
  });
});
