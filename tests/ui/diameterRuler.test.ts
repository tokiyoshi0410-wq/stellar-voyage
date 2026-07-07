import { describe, it, expect } from 'vitest';
import { DiameterRuler } from '../../src/ui/DiameterRuler';

describe('DiameterRuler', () => {
  it('is hidden initially, positions/sizes/labels on update, hides on hide', () => {
    const root = document.createElement('div');
    const r = new DiameterRuler(root);
    const el = root.firstElementChild as HTMLElement;
    expect(el.style.display).toBe('none');
    r.update(100, 400, 250, '太陽系 ・ 直径 約90億km');
    expect(el.style.display).toBe('block');
    expect(el.style.left).toBe('100px');
    expect(el.style.top).toBe('250px');
    expect(el.style.width).toBe('300px'); // 400 - 100
    expect(root.textContent).toContain('太陽系 ・ 直径 約90億km');
    r.hide();
    expect(el.style.display).toBe('none');
  });
  it('clamps negative width to 0', () => {
    const root = document.createElement('div');
    const r = new DiameterRuler(root);
    r.update(400, 100, 250, 'x'); // 左右が逆でも負幅にしない
    const el = root.firstElementChild as HTMLElement;
    expect(el.style.width).toBe('0px');
  });
});
