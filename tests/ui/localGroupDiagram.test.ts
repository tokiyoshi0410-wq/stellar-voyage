import { describe, it, expect } from 'vitest';
import { LocalGroupDiagram } from '../../src/ui/LocalGroupDiagram';

describe('LocalGroupDiagram', () => {
  it('contains the two galaxies, distance and current-location marker', () => {
    const root = document.createElement('div');
    new LocalGroupDiagram(root);
    const t = root.textContent ?? '';
    expect(t).toContain('天の川銀河');
    expect(t).toContain('アンドロメダ');
    expect(t).toContain('約250万光年');
    expect(t).toContain('現在地');
  });
  it('is hidden by default and toggles with setVisible', () => {
    const root = document.createElement('div');
    const d = new LocalGroupDiagram(root);
    const wrap = root.querySelector('div') as HTMLDivElement;
    expect(wrap.style.display).toBe('none');
    d.setVisible(true);
    expect(wrap.style.display).toBe('block');
    d.setVisible(false);
    expect(wrap.style.display).toBe('none');
  });
  it('does not block clicks (pointer-events:none)', () => {
    const root = document.createElement('div');
    new LocalGroupDiagram(root);
    expect((root.querySelector('div') as HTMLDivElement).style.pointerEvents).toBe('none');
  });
});
