import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { StarField } from '../../src/starfield/StarField';

const columns = {
  count: 3,
  x: new Float32Array([0, 1, 2]), y: new Float32Array([0, 0, 0]), z: new Float32Array([0, 0, 0]),
  mag: new Float32Array([1, 2, 3]), absmag: new Float32Array([1, 1, 1]), ci: new Float32Array([0, 0, 0]),
};

describe('StarField.setFocus', () => {
  it('hides the focused star point and restores the previous one', () => {
    const f = new StarField(columns);
    const size = () => (f.object.geometry.getAttribute('size') as THREE.BufferAttribute).array as Float32Array;
    const before1 = size()[1];
    f.setFocus([1, 0, 0], 1);
    expect(size()[1]).toBe(0);
    f.setFocus([2, 0, 0], 2);
    expect(size()[1]).toBeCloseTo(before1!, 6); // restored
    expect(size()[2]).toBe(0);
  });
});
