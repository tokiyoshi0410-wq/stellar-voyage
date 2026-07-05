export class ScaleBar {
  private readonly line: HTMLDivElement;
  private readonly label: HTMLDivElement;
  private readonly wrap: HTMLDivElement;
  private lastKey = '';

  constructor(root: HTMLElement) {
    this.wrap = document.createElement('div');
    this.wrap.style.cssText =
      'position:fixed;left:16px;bottom:16px;color:#eaf2ff;font:12px system-ui,sans-serif;' +
      'text-shadow:0 0 3px #000;pointer-events:none;';
    this.line = document.createElement('div');
    this.line.style.cssText =
      'height:8px;border-left:2px solid #eaf2ff;border-right:2px solid #eaf2ff;' +
      'border-bottom:2px solid #eaf2ff;box-sizing:border-box;';
    this.label = document.createElement('div');
    this.label.style.marginTop = '3px';
    this.wrap.append(this.line, this.label);
    root.appendChild(this.wrap);
  }

  update(bar: { label: string; widthPx: number }): void {
    const key = `${bar.label}|${Math.round(bar.widthPx)}`;
    if (key === this.lastKey) return; // 内容不変なら DOM 操作を省く（毎フレーム呼ばれる）
    this.lastKey = key;
    this.line.style.width = `${bar.widthPx}px`;
    this.label.textContent = bar.label;
  }

  setVisible(v: boolean): void {
    this.wrap.style.display = v ? 'block' : 'none';
  }
}
