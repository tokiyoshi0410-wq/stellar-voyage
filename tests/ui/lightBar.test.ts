import { describe, it, expect } from 'vitest';
import { LightBar } from '../../src/ui/LightBar';

const STOPS = [
  { name: '木星', earthDistAu: 4.2 },
  { name: '海王星', earthDistAu: 29 },
];

describe('LightBar', () => {
  it('is hidden initially, shows text on update, hides on hide', () => {
    const root = document.createElement('div');
    const bar = new LightBar(root, STOPS, 29);
    const container = root.firstElementChild as HTMLElement;
    expect(container.style.display).toBe('none');
    bar.update(0.5, '光の経過時間: 約34分 ・ 木星に到達');
    expect(container.style.display).toBe('block');
    expect(root.textContent).toContain('木星に到達');
    bar.hide();
    expect(container.style.display).toBe('none');
  });
  it('renders the 地球 anchor and each stop label', () => {
    const root = document.createElement('div');
    new LightBar(root, STOPS, 29);
    expect(root.textContent).toContain('地球');
    expect(root.textContent).toContain('木星');
    expect(root.textContent).toContain('海王星');
  });
});
