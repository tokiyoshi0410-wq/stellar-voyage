export class SystemHud {
  private readonly el: HTMLDivElement;
  private readonly starEl: HTMLDivElement;
  private readonly targetEl: HTMLDivElement;
  private readonly exitBtn: HTMLButtonElement;

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;left:16px;top:16px;color:#eaf2ff;font:14px/1.6 system-ui,sans-serif;' +
      'text-shadow:0 0 4px #000;display:none;';
    this.starEl = document.createElement('div');
    this.targetEl = document.createElement('div');
    this.exitBtn = document.createElement('button');
    this.exitBtn.textContent = '系を出る';
    this.exitBtn.style.cssText = 'margin-top:8px;padding:6px 12px;cursor:pointer;' +
      'background:#1c3a63;color:#eaf2ff;border:1px solid #3a6ea5;border-radius:6px;font:13px system-ui;';
    this.el.append(this.starEl, this.targetEl, this.exitBtn);
    root.appendChild(this.el);
  }

  show(starName: string, onExit: () => void): void {
    this.starEl.textContent = `恒星: ${starName}`;
    this.targetEl.textContent = '目標: —';
    this.exitBtn.onclick = onExit;
    this.el.style.display = 'block';
  }

  setTarget(name: string | null): void {
    this.targetEl.textContent = `目標: ${name ?? '—'}`;
  }

  hide(): void {
    this.el.style.display = 'none';
  }
}
