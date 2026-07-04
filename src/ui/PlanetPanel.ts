import type { Planet, PlanetType } from '../system/types';

const TYPE_LABEL: Record<PlanetType, string> = {
  rock: '岩石惑星', ocean: '海洋惑星', gas: 'ガス惑星', ice: '氷惑星',
};

export function describePlanet(p: Planet): string {
  const badge = p.isReal ? '実在' : '生成';
  const hz = p.inHabitableZone ? 'ハビタブルゾーン内' : 'ハビタブルゾーン外';
  const est = p.estimated ? '（推定値）' : '';
  const temp = p.eqTempK != null ? `平衡温度: ${Math.round(p.eqTempK)} K\n` : '';
  return `${p.name}（${badge}）\n` +
    `種別: ${TYPE_LABEL[p.type]}\n` +
    `軌道長半径: ${p.semiMajorAxisAu.toPrecision(3)} AU\n` +
    `半径: 地球の ${p.radiusEarth.toPrecision(3)} 倍${est}\n` +
    `質量: 地球の ${p.massEarth.toPrecision(3)} 倍${est}\n` +
    temp +
    `${hz}`;
}

export class PlanetPanel {
  private readonly el: HTMLDivElement;
  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;right:16px;top:16px;min-width:220px;color:#eaf2ff;' +
      'background:rgba(8,14,28,0.82);border:1px solid #2b4a7a;border-radius:8px;' +
      'padding:12px 16px;font:13px/1.6 system-ui,sans-serif;white-space:pre-line;display:none;';
    root.appendChild(this.el);
  }
  show(planet: Planet): void {
    this.el.textContent = describePlanet(planet); // textContent で XSS 回避
    this.el.style.display = 'block';
  }
  hide(): void { this.el.style.display = 'none'; }
}
