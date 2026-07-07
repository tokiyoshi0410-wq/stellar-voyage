// 天体の直径を示す横向きの定規（両端キャップ付きの線＋直径ラベル）。
// app が毎フレーム、見えている主天体の実幅をスクリーン座標へ投影して left/right/y を渡す。
export class DiameterRuler {
  private readonly root: HTMLDivElement;
  private readonly label: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;pointer-events:none;display:none;height:0;' +
      'border-top:1.5px solid rgba(150,200,255,0.7);' +
      'font:12px system-ui,sans-serif;color:#cfe2ff;text-shadow:0 0 4px #000;';

    // 左右のキャップ
    const capL = document.createElement('div');
    capL.style.cssText = 'position:absolute;left:0;top:-5px;width:1.5px;height:10px;background:rgba(150,200,255,0.7);';
    const capR = document.createElement('div');
    capR.style.cssText = 'position:absolute;right:0;top:-5px;width:1.5px;height:10px;background:rgba(150,200,255,0.7);';

    this.label = document.createElement('div');
    this.label.style.cssText = 'position:absolute;left:0;right:0;top:7px;text-align:center;white-space:nowrap;';

    this.root.appendChild(capL);
    this.root.appendChild(capR);
    this.root.appendChild(this.label);
    parent.appendChild(this.root);
  }

  update(leftPx: number, rightPx: number, yPx: number, text: string): void {
    this.root.style.left = `${leftPx}px`;
    this.root.style.top = `${yPx}px`;
    this.root.style.width = `${Math.max(0, rightPx - leftPx)}px`;
    this.label.textContent = text;
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}
