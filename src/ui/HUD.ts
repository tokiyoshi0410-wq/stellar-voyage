import { formatSpeed } from './format';

export class HUD {
  private readonly el: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;left:16px;bottom:16px;color:#cfe4ff;font:14px/1.5 monospace;' +
      'text-shadow:0 0 4px #000;pointer-events:none;';
    root.appendChild(this.el);
  }

  update(speedC: number, isWarp: boolean, target: string | null): void {
    const mode = isWarp ? 'ワープ航行' : '通常航行';
    this.el.innerHTML =
      `速度: ${formatSpeed(speedC)}<br>` +
      `モード: ${mode}<br>` +
      `目標: ${target ?? '—'}`;
  }

  hide(): void {
    this.el.style.display = 'none';
  }

  show(): void {
    this.el.style.display = 'block';
  }
}
