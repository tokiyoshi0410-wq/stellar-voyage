export class ScalePanel {
  private readonly titleEl: HTMLDivElement;
  private readonly bodyEl: HTMLDivElement;
  private readonly lineEls: HTMLDivElement[] = [];
  private lastKey = '';

  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;left:16px;top:16px;min-width:200px;max-width:min(320px,60vw);' +
      'color:#eaf2ff;background:rgba(8,14,28,0.82);border:1px solid #2b4a7a;border-radius:8px;' +
      'padding:12px 16px;font:13px/1.7 system-ui,sans-serif;pointer-events:none;';
    this.titleEl = document.createElement('div');
    this.titleEl.style.cssText = 'font-size:15px;font-weight:600;margin-bottom:4px;color:#bcd7ff;';
    this.bodyEl = document.createElement('div');
    el.append(this.titleEl, this.bodyEl);
    root.appendChild(el);
  }

  update(info: { title: string; lines: string[] }): void {
    const key = info.title + '\n' + info.lines.join('\n');
    if (key === this.lastKey) return; // 内容不変なら DOM 操作を省く（毎フレーム呼ばれる）
    this.lastKey = key;
    this.titleEl.textContent = `【${info.title}】`;
    for (let i = 0; i < info.lines.length; i++) {
      let d = this.lineEls[i];
      if (!d) { d = document.createElement('div'); this.bodyEl.appendChild(d); this.lineEls[i] = d; }
      d.textContent = info.lines[i]!;
      d.style.display = 'block';
    }
    for (let i = info.lines.length; i < this.lineEls.length; i++) this.lineEls[i]!.style.display = 'none';
  }
}
