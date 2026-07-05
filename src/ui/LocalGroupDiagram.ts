export class LocalGroupDiagram {
  private readonly wrap: HTMLDivElement;

  constructor(root: HTMLElement) {
    this.wrap = document.createElement('div');
    this.wrap.style.cssText =
      'position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);display:none;' +
      'color:#eaf2ff;font:13px system-ui,sans-serif;text-align:center;pointer-events:none;' +
      'text-shadow:0 0 4px #000;';
    // 静的リテラルのみ（外部データ非注入なので innerHTML でも XSS なし）
    this.wrap.innerHTML =
      '<div style="font-size:15px;font-weight:600;color:#bcd7ff;margin-bottom:16px">【局部銀河群】</div>' +
      '<div style="display:flex;align-items:center;justify-content:center;gap:12px">' +
        '<div>' +
          '<div style="width:70px;height:34px;border-radius:50%;background:radial-gradient(circle,#cfe0ff,#4a6ea5);margin:0 auto"></div>' +
          '<div style="margin-top:6px">天の川銀河</div>' +
          '<div style="color:#ffd479">↑現在地（太陽系）</div>' +
        '</div>' +
        '<div style="flex:1;min-width:120px">' +
          '<div style="border-top:1px solid #9fb6d6"></div>' +
          '<div style="margin-top:4px">約250万光年</div>' +
        '</div>' +
        '<div>' +
          '<div style="width:80px;height:40px;border-radius:50%;background:radial-gradient(circle,#e6d5ff,#7a5aa5);margin:0 auto"></div>' +
          '<div style="margin-top:6px">アンドロメダ銀河<br>（M31）</div>' +
        '</div>' +
      '</div>';
    root.appendChild(this.wrap);
  }

  setVisible(v: boolean): void {
    this.wrap.style.display = v ? 'block' : 'none';
  }
}
