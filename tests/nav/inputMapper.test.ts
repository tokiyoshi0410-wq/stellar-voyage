import { describe, it, expect } from 'vitest';
import { InputMapper } from '../../src/nav/InputMapper';

function makeTarget() {
  const L: Record<string, ((e: any) => void)[]> = {};
  return {
    el: { addEventListener: (t: string, cb: any) => { (L[t] ??= []).push(cb); }, removeEventListener: () => {} } as unknown as HTMLElement,
    fire: (t: string, e: any) => { (L[t] ?? []).forEach((cb) => cb(e)); },
  };
}

describe('InputMapper', () => {
  it('accumulates drag only while pointer is down', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    t.fire('pointermove', { movementX: 5, movementY: 5 }); // not down → ignored
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });
    t.fire('pointerdown', {}); t.fire('pointermove', { movementX: 3, movementY: -2 });
    expect(m.consumeDrag()).toEqual({ dx: 3, dy: -2 });
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });
    t.fire('pointerup', {}); t.fire('pointermove', { movementX: 9, movementY: 9 });
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });
  });
  it('accumulates and resets wheel', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    t.fire('wheel', { deltaY: 100 }); t.fire('wheel', { deltaY: 20 });
    expect(m.consumeWheel()).toBe(120);
    expect(m.consumeWheel()).toBe(0);
  });
  it('maps WASD to forward/right via window keyboard events (canvas is not focusable)', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    expect(m.movement()).toEqual({ forward: 1, right: 1 });
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' })); // W and S → forward 0
    expect(m.movement()).toEqual({ forward: 0, right: 1 });
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD' }));
    expect(m.movement()).toEqual({ forward: 0, right: 0 });
    // release remaining keys so no state leaks into other tests via the shared window
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS' }));
    m.dispose();
    // after dispose(), window keydown must no longer affect movement()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(m.movement()).toEqual({ forward: 0, right: 0 });
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' })); // cleanup in case dispose didn't work
  });
  it('clears held keys and drag on window blur (alt-tab must not leave keys stuck)', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    t.fire('pointerdown', {});
    expect(m.movement()).toEqual({ forward: 1, right: 0 });
    window.dispatchEvent(new Event('blur'));
    expect(m.movement()).toEqual({ forward: 0, right: 0 }); // keys cleared
    t.fire('pointermove', { movementX: 5, movementY: 5 });
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });       // down cleared
    m.dispose();
    // after dispose(), a later blur must be a no-op (listener removed)
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
  });
});

describe('InputMapper.consumePauseToggle', () => {
  it('fires once per physical Space press and clears on consume', () => {
    const kd = () => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    const ku = () => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    const im = new InputMapper(document.createElement('div'));
    expect(im.consumePauseToggle()).toBe(false);   // 無押下
    kd();
    expect(im.consumePauseToggle()).toBe(true);     // 押下でエッジ
    expect(im.consumePauseToggle()).toBe(false);    // consume 済
    kd();                                            // auto-repeat（keyup 無し）
    expect(im.consumePauseToggle()).toBe(false);    // 再発火しない
    ku(); kd();                                      // 離して再押下
    expect(im.consumePauseToggle()).toBe(true);     // 再びエッジ
    im.dispose();
  });
});
