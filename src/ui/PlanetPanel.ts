import type { Planet, PlanetType } from '../system/types';
import type { PlanetFacts } from '../system/solarFacts';
import { formatManKm, formatLightTravel, formatShinkansenTravel } from '../system/solarFacts';

const TYPE_LABEL: Record<PlanetType, string> = {
  rock: '岩石惑星', ocean: '海洋惑星', gas: 'ガス惑星', ice: '氷惑星',
};

export function describePlanet(p: Planet, facts?: PlanetFacts, closestAu?: number): string {
  const badge = p.isReal ? '実在' : '生成';
  const hz = p.inHabitableZone ? 'ハビタブルゾーン内' : 'ハビタブルゾーン外';
  const est = p.estimated ? '（推定値）' : '';
  const temp = p.eqTempK != null ? `平衡温度: ${Math.round(p.eqTempK)} K\n` : '';
  let s = `${p.name}（${badge}）\n` +
    `種別: ${TYPE_LABEL[p.type]}\n` +
    `軌道長半径: ${p.semiMajorAxisAu.toPrecision(3)} AU\n` +
    `半径: 地球の ${p.radiusEarth.toPrecision(3)} 倍${est}\n` +
    `質量: 地球の ${p.massEarth.toPrecision(3)} 倍${est}\n` +
    temp +
    `${hz}`;
  if (facts) {
    s += `\n公転: ${facts.orbitalSpeedKmS} km/s ・ 周期 ${facts.orbitalPeriodYr} 年` +
      `\n自転: 赤道 ${facts.rotationSpeedKmH} km/h${facts.retrograde ? '(逆回転)' : ''}`;
    if (closestAu != null && closestAu > 0) {
      s += `\n地球から最接近: ${formatManKm(closestAu)}（約${closestAu.toPrecision(2)} AU）` +
        `\n　光の速度で ${formatLightTravel(closestAu)}` +
        `\n　新幹線(300km/h)で ${formatShinkansenTravel(closestAu)}`;
    } else if (closestAu === 0) {
      s += `\n太陽からの距離: 1 AU（母星）`;
    }
  }
  return s;
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
  show(planet: Planet, facts?: PlanetFacts, closestAu?: number): void {
    this.el.textContent = describePlanet(planet, facts, closestAu); // textContent で XSS 回避
    this.el.style.display = 'block';
  }
  showText(text: string): void {
    this.el.textContent = text;
    this.el.style.display = 'block';
  }
  hide(): void { this.el.style.display = 'none'; }
}
