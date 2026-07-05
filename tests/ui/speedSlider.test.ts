import { describe, it, expect } from 'vitest';
import { SpeedSlider } from '../../src/ui/SpeedSlider';

describe('SpeedSlider', () => {
  it('reads the range input value in [0,1]', () => {
    const root = document.createElement('div');
    const s = new SpeedSlider(root);
    const input = root.querySelector('input[type=range]') as HTMLInputElement;
    input.value = '0.5';
    expect(s.value()).toBeCloseTo(0.5, 3);
  });
  it('writes a Japanese readout with speed and focus name', () => {
    const root = document.createElement('div');
    const s = new SpeedSlider(root);
    s.setReadout(2, '太陽');
    expect(root.textContent).toMatch(/AU\/秒/);
    expect(root.textContent).toMatch(/太陽/);
  });
});
