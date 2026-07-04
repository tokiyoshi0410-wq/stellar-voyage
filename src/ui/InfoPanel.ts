import type { StarInfo } from './format';

export class InfoPanel {
  private readonly el: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;right:16px;top:16px;min-width:220px;color:#eaf2ff;' +
      'background:rgba(8,14,28,0.82);border:1px solid #2b4a7a;border-radius:8px;' +
      'padding:12px 16px;font:13px/1.6 system-ui,sans-serif;display:none;';
    root.appendChild(this.el);
  }

  show(info: StarInfo): void {
    const real = info.isReal ? '<span style="color:#7fd1ff">実在</span>' : '生成';
    this.el.innerHTML =
      `<div style="font-size:16px;font-weight:600;margin-bottom:6px">${info.title} ${real}</div>` +
      `スペクトル型: ${info.spectralClass}<br>` +
      `表面温度: ${info.temperatureK.toLocaleString('ja-JP')} K<br>` +
      `光度: 太陽の ${info.luminositySun.toPrecision(3)} 倍<br>` +
      `距離: ${Math.round(info.distanceLy).toLocaleString('ja-JP')} 光年`;
    this.el.style.display = 'block';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
