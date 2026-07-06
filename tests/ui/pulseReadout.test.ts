import { describe, it, expect } from 'vitest';
import { PulseReadout } from '../../src/ui/PulseReadout';

describe('PulseReadout', () => {
  it('is hidden initially, shows text on update, hides on hide', () => {
    const root = document.createElement('div');
    const r = new PulseReadout(root);
    const el = root.querySelector('div')!;
    expect(el.style.display).toBe('none');
    r.update('光の経過時間: 8分19秒');
    expect(el.textContent).toBe('光の経過時間: 8分19秒');
    expect(el.style.display).toBe('block');
    r.hide();
    expect(el.style.display).toBe('none');
  });
});
