export class PauseButton {
  private readonly btn: HTMLButtonElement;

  constructor(root: HTMLElement, onToggle: () => void) {
    this.btn = document.createElement('button');
    this.btn.style.cssText =
      'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);' +
      'padding:6px 14px;border:1px solid #6a7a9a;border-radius:6px;' +
      'background:rgba(20,28,44,0.8);color:#eaf2ff;font:13px system-ui,sans-serif;' +
      'cursor:pointer;text-shadow:0 0 4px #000;';
    this.btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btn.addEventListener('click', (e) => { e.stopPropagation(); onToggle(); });
    root.appendChild(this.btn);
    this.setPaused(false);
  }

  setPaused(paused: boolean): void {
    this.btn.textContent = paused ? '▶ 再生' : '⏸ 停止';
  }
}
