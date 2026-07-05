import { formatSpeed } from '../nav/speed';

export class SpeedSlider {
  private readonly input: HTMLInputElement;
  private readonly readout: HTMLDivElement;

  constructor(root: HTMLElement) {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:min(420px,80vw);' +
      'color:#eaf2ff;font:13px system-ui,sans-serif;text-align:center;text-shadow:0 0 4px #000;';
    this.readout = document.createElement('div');
    this.readout.style.marginBottom = '6px';
    this.input = document.createElement('input');
    this.input.type = 'range';
    this.input.min = '0'; this.input.max = '1'; this.input.step = '0.001'; this.input.value = '0.25';
    this.input.style.width = '100%';
    wrap.append(this.readout, this.input);
    root.appendChild(wrap);
    this.setReadout(0, '—');
  }

  value(): number { return Number(this.input.value); }

  setReadout(auPerSec: number, focusName: string): void {
    this.readout.textContent = `速度: ${formatSpeed(auPerSec)}　｜　対象: ${focusName}`;
  }
}
