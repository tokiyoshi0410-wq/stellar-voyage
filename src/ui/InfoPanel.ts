import type { StarInfo } from './format';
import { formatLuminosity, formatLy } from './format';

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
    // カタログ名（外部由来文字列）は textContent で挿入し、innerHTML の注入を避ける。
    this.el.replaceChildren();

    const head = document.createElement('div');
    head.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:6px';
    head.append(document.createTextNode(`${info.title} `));
    const badge = document.createElement('span');
    badge.style.color = info.isReal ? '#7fd1ff' : '#9fb0c8';
    badge.textContent = info.isReal ? '実在' : '生成';
    head.appendChild(badge);
    this.el.appendChild(head);

    const body = document.createElement('div');
    body.textContent =
      `スペクトル型: ${info.spectralClass}\n` +
      `表面温度: ${info.temperatureK.toLocaleString('ja-JP')} K\n` +
      `光度: 太陽の ${formatLuminosity(info.luminositySun)} 倍\n` +
      `距離: ${formatLy(info.distanceLy)}`;
    body.style.whiteSpace = 'pre';
    this.el.appendChild(body);

    this.el.style.display = 'block';
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
