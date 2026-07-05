export class ControlHints {
  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;right:16px;bottom:16px;color:#9fb6d6;font:12px/1.6 system-ui,sans-serif;' +
      'text-align:right;text-shadow:0 0 4px #000;pointer-events:none;';
    el.innerHTML = 'ドラッグ: 視点<br>ホイール: ズーム<br>WASD: 移動<br>クリック: 選択';
    root.appendChild(el);
  }
}
