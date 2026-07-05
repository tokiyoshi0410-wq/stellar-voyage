import { describe, it, expect } from 'vitest';
import { ScalePanel } from '../../src/ui/ScalePanel';

describe('ScalePanel', () => {
  it('renders the title in 【】 and every line', () => {
    const root = document.createElement('div');
    const p = new ScalePanel(root);
    p.update({ title: '太陽系', lines: ['端から端 約90億km', '光でも約8時間'] });
    expect(root.textContent).toContain('【太陽系】');
    expect(root.textContent).toContain('端から端 約90億km');
    expect(root.textContent).toContain('光でも約8時間');
  });
  it('updates the title when the stage changes', () => {
    const root = document.createElement('div');
    const p = new ScalePanel(root);
    p.update({ title: '太陽系', lines: ['a'] });
    p.update({ title: '天の川銀河', lines: ['星の数 約2000億個'] });
    expect(root.textContent).toContain('【天の川銀河】');
    expect(root.textContent).not.toContain('【太陽系】');
    expect(root.textContent).toContain('星の数 約2000億個');
  });
  it('does not block clicks (pointer-events:none)', () => {
    const root = document.createElement('div');
    new ScalePanel(root);
    const panel = root.querySelector('div') as HTMLDivElement;
    expect(panel.style.pointerEvents).toBe('none');
  });
});
