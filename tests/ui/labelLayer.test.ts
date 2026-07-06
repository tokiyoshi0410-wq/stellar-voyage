import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { LabelLayer } from '../../src/ui/LabelLayer';

function rootWithSize() {
  const root = document.createElement('div');
  Object.defineProperty(root, 'clientWidth', { value: 800 });
  Object.defineProperty(root, 'clientHeight', { value: 600 });
  return root;
}
function camAtOrigin() {
  const cam = new THREE.PerspectiveCamera(60, 800 / 600, 0.1, 1000);
  cam.position.set(0, 0, 10);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld(true);
  return cam;
}

describe('LabelLayer', () => {
  it('shows an on-screen label with its text', () => {
    const root = rootWithSize();
    const layer = new LabelLayer(root);
    layer.render([{ text: '地球', worldPos: [0, 0, 0] }], camAtOrigin(), root);
    const container = root.querySelector('div')!;
    const label = container.children[0] as HTMLDivElement;
    expect(label.textContent).toBe('地球');
    expect(label.style.display).toBe('block');
  });
  it('hides a label positioned behind the camera', () => {
    const root = rootWithSize();
    const layer = new LabelLayer(root);
    layer.render([{ text: 'behind', worldPos: [0, 0, 100] }], camAtOrigin(), root);
    const container = root.querySelector('div')!;
    const label = container.children[0] as HTMLDivElement;
    expect(label.style.display).toBe('none');
  });
  it('reuses the element pool: fewer items hides the extras', () => {
    const root = rootWithSize();
    const layer = new LabelLayer(root);
    const cam = camAtOrigin();
    layer.render([{ text: 'a', worldPos: [0, 0, 0] }, { text: 'b', worldPos: [1, 0, 0] }], cam, root);
    layer.render([{ text: 'a', worldPos: [0, 0, 0] }], cam, root);
    const container = root.querySelector('div')!;
    expect(container.children.length).toBe(2); // pool kept
    expect((container.children[1] as HTMLDivElement).style.display).toBe('none'); // extra hidden
  });
  it('applies an optional dyPx screen offset to the vertical position', () => {
    const root = rootWithSize();
    const layer = new LabelLayer(root);
    const cam = camAtOrigin();
    const topOf = (el: HTMLDivElement) => parseFloat(el.style.transform.match(/translate\([-\d.]+px, ([-\d.]+)px\)/)![1]!);
    layer.render([{ text: 'x', worldPos: [0, 0, 0] }], cam, root);
    const base = topOf(root.querySelector('div')!.children[0] as HTMLDivElement);
    layer.render([{ text: 'x', worldPos: [0, 0, 0], dyPx: 20 }], cam, root);
    const shifted = topOf(root.querySelector('div')!.children[0] as HTMLDivElement);
    expect(shifted - base).toBeCloseTo(20, 5);
  });
});
