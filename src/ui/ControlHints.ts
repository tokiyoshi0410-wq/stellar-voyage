export class ControlHints {
  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;right:16px;bottom:16px;color:#9fb6d6;font:12px/1.6 system-ui,sans-serif;' +
      'text-align:right;text-shadow:0 0 4px #000;pointer-events:none;';
    // 主ポインタがタッチ（スマホ/タブレット）なら指操作の説明を出す。
    const isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      || (navigator.maxTouchPoints ?? 0) > 0;
    el.innerHTML = isTouch
      ? '1本指ドラッグ: 視点<br>2本指ピンチ: ズーム<br>タップ: 選択'
      : 'ドラッグ: 視点<br>ホイール: ズーム<br>WASD: 移動<br>クリック: 選択';
    root.appendChild(el);
  }
}
