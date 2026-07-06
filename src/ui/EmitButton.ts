// 「光を放つ」ボタン。PauseButton と同じ流儀（fixed 配置・pointerdown/click stopPropagation で
// キャンバスのクリック選択と干渉させない）。bottom は停止ボタン(64px)の上に重ねない位置。
export class EmitButton {
  private readonly btn: HTMLButtonElement;
  constructor(root: HTMLElement, onEmit: () => void) {
    this.btn = document.createElement('button');
    this.btn.textContent = '💡 光を放つ';
    this.btn.style.cssText =
      'position:fixed;left:50%;bottom:104px;transform:translateX(-50%);' +
      'padding:6px 14px;border:1px solid #6a5a2a;border-radius:6px;' +
      'background:rgba(28,24,12,0.8);color:#fff2cc;font:13px system-ui,sans-serif;' +
      'cursor:pointer;text-shadow:0 0 4px #000;';
    this.btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.btn.addEventListener('click', (e) => { e.stopPropagation(); onEmit(); });
    root.appendChild(this.btn);
  }
}
