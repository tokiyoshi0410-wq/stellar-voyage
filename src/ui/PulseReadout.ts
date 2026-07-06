// 光の経過時間カウンタ（下部中央・ScalePanel 流儀の DOM オーバーレイ・クリック非干渉）。
export class PulseReadout {
  private readonly el: HTMLDivElement;
  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;left:50%;bottom:140px;transform:translateX(-50%);' +
      'color:#fff2cc;background:rgba(8,14,28,0.82);border:1px solid #6a5a2a;border-radius:6px;' +
      'padding:6px 14px;font:13px system-ui,sans-serif;text-shadow:0 0 4px #000;' +
      'pointer-events:none;display:none;white-space:nowrap;';
    root.appendChild(this.el);
  }
  update(text: string): void { this.el.textContent = text; this.el.style.display = 'block'; }
  hide(): void { this.el.style.display = 'none'; }
}
