import * as THREE from 'three';

export type LabelItem = { text: string; worldPos: [number, number, number] };

export class LabelLayer {
  private readonly container: HTMLDivElement;
  private readonly pool: HTMLDivElement[] = [];
  private readonly v = new THREE.Vector3();

  constructor(root: HTMLElement) {
    this.container = document.createElement('div');
    this.container.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;';
    root.appendChild(this.container);
  }

  render(items: LabelItem[], camera: THREE.Camera, domEl: HTMLElement): void {
    const w = domEl.clientWidth, h = domEl.clientHeight;
    for (let i = 0; i < items.length; i++) {
      const el = this.ensure(i);
      const item = items[i]!;
      this.v.set(item.worldPos[0], item.worldPos[1], item.worldPos[2]).project(camera);
      if (this.v.z < -1 || this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05) {
        el.style.display = 'none';
        continue;
      }
      const left = (this.v.x * 0.5 + 0.5) * w;
      const top = (-this.v.y * 0.5 + 0.5) * h;
      el.textContent = item.text;
      el.style.transform = `translate(${left}px, ${top}px) translate(0, -50%)`;
      el.style.display = 'block';
    }
    for (let i = items.length; i < this.pool.length; i++) this.pool[i]!.style.display = 'none';
  }

  private ensure(i: number): HTMLDivElement {
    let el = this.pool[i];
    if (!el) {
      el = document.createElement('div');
      el.style.cssText =
        'position:absolute;left:0;top:0;color:#d6e4ff;font:11px system-ui,sans-serif;' +
        'text-shadow:0 0 3px #000,0 0 3px #000;white-space:pre;pointer-events:none;padding-left:6px;';
      this.container.appendChild(el);
      this.pool[i] = el;
    }
    return el;
  }
}
