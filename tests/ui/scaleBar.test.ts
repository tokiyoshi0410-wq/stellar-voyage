import { describe, it, expect } from 'vitest';
import { ScaleBar } from '../../src/ui/ScaleBar';

describe('ScaleBar', () => {
  it('renders the label and sets the bar width', () => {
    const root = document.createElement('div');
    const b = new ScaleBar(root);
    b.update({ label: '10 AU ≈ 15億km（光で83分）', widthPx: 120 });
    expect(root.textContent).toContain('10 AU');
    const line = root.querySelectorAll('div')[1] as HTMLDivElement; // wrap > [line, label]
    expect(line.style.width).toBe('120px');
  });
  it('does not block clicks (pointer-events:none)', () => {
    const root = document.createElement('div');
    new ScaleBar(root);
    const wrap = root.querySelector('div') as HTMLDivElement;
    expect(wrap.style.pointerEvents).toBe('none');
  });
});
