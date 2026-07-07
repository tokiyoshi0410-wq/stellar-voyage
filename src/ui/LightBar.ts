import type { BarStop } from '../edu/lightBar';

// 画面上部の光速バー。左端=地球（現在地）、右端=最遠の惑星（海王星）。
// 惑星の目盛り＋光マーカー＋経過光行時間テキスト。3D 球パルスの置き換え。
export class LightBar {
  private readonly root: HTMLDivElement;
  private readonly marker: HTMLDivElement;
  private readonly readout: HTMLDivElement;

  constructor(parent: HTMLElement, stops: BarStop[], rightAu: number) {
    this.root = document.createElement('div');
    this.root.style.cssText =
      'position:fixed;left:22%;top:14px;width:60%;height:68px;' +
      'pointer-events:none;display:none;font:11px system-ui,sans-serif;color:#dbe8ff;';

    // トラック（横線）
    const track = document.createElement('div');
    track.style.cssText =
      'position:absolute;left:0;right:0;top:32px;height:2px;background:rgba(160,190,255,0.35);';
    this.root.appendChild(track);

    // 地球（左端）＋各惑星の目盛り。隣接ラベルの重なりを避けるため上下段で交互配置。
    this.root.appendChild(this.makeTick(0, '地球', true, 0));
    stops.forEach((s, i) => this.root.appendChild(this.makeTick(s.earthDistAu / rightAu, s.name, false, (i + 1) % 2)));

    // 光マーカー（左端から右へ動く）
    this.marker = document.createElement('div');
    this.marker.style.cssText =
      'position:absolute;top:26px;left:0;width:14px;height:14px;margin-left:-7px;border-radius:50%;' +
      'background:#fff2cc;box-shadow:0 0 10px 3px #ffdf80;';
    this.root.appendChild(this.marker);

    // 経過時間テキスト（バー上部・中央）
    this.readout = document.createElement('div');
    this.readout.style.cssText =
      'position:absolute;left:0;right:0;top:0;text-align:center;text-shadow:0 0 4px #000;';
    this.root.appendChild(this.readout);

    parent.appendChild(this.root);
  }

  private makeTick(frac: number, label: string, home: boolean, row: number): HTMLDivElement {
    const t = document.createElement('div');
    t.style.cssText =
      `position:absolute;top:28px;left:${(frac * 100).toFixed(2)}%;transform:translateX(-50%);text-align:center;`;
    const dot = document.createElement('div');
    dot.style.cssText =
      `width:${home ? 7 : 5}px;height:${home ? 7 : 5}px;margin:0 auto;border-radius:50%;` +
      `background:${home ? '#8fd4ff' : 'rgba(205,220,255,0.9)'};`;
    const cap = document.createElement('div');
    cap.textContent = label;
    // 隣接ラベルの重なりを避けるため row で上下にずらす
    cap.style.cssText = `margin-top:${row === 0 ? 4 : 18}px;white-space:nowrap;`;
    t.appendChild(dot);
    t.appendChild(cap);
    return t;
  }

  update(fraction: number, text: string): void {
    this.root.style.display = 'block';
    this.marker.style.left = `${(fraction * 100).toFixed(2)}%`;
    this.readout.textContent = text;
  }

  hide(): void {
    this.root.style.display = 'none';
  }
}
