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
  it('accumulates single-finger drag from pointer position deltas while down (touch-safe)', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    t.fire('pointermove', { pointerId: 1, clientX: 5, clientY: 5 }); // not down → ignored
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });
    t.fire('pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
    t.fire('pointermove', { pointerId: 1, clientX: 13, clientY: 8 }); // Δ(+3,-2)
    expect(m.consumeDrag()).toEqual({ dx: 3, dy: -2 });
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });
    t.fire('pointerup', { pointerId: 1, clientX: 13, clientY: 8 });
    t.fire('pointermove', { pointerId: 1, clientX: 22, clientY: 17 }); // up → ignored
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });
  });

  it('two-finger pinch produces a zoom factor and does not drag', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    t.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    t.fire('pointerdown', { pointerId: 2, clientX: 100, clientY: 0 }); // dist 100
    t.fire('pointermove', { pointerId: 2, clientX: 200, clientY: 0 }); // dist 200 → 指を広げた
    expect(m.consumePinch()).toBeCloseTo(0.5, 5); // 広げる = ズームイン(<1)
    expect(m.consumePinch()).toBe(1);             // consume でリセット
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 }); // 二本指中はドラッグしない
  });

  it('single-finger drag resumes cleanly after one of two fingers lifts (no jump)', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    t.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    t.fire('pointerdown', { pointerId: 2, clientX: 100, clientY: 0 });
    t.fire('pointermove', { pointerId: 1, clientX: 10, clientY: 0 }); // 二本指 → drag せず pos だけ更新
    m.consumeDrag(); m.consumePinch();
    t.fire('pointerup', { pointerId: 2, clientX: 100, clientY: 0 });  // 一本指に戻る(id1 は x=10)
    t.fire('pointermove', { pointerId: 1, clientX: 15, clientY: 0 }); // Δ = 15-10 = +5（0 からではない）
    expect(m.consumeDrag()).toEqual({ dx: 5, dy: 0 });
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
    t.fire('pointerdown', { pointerId: 1, clientX: 0, clientY: 0 });
    expect(m.movement()).toEqual({ forward: 1, right: 0 });
    window.dispatchEvent(new Event('blur'));
    expect(m.movement()).toEqual({ forward: 0, right: 0 }); // keys cleared
    t.fire('pointermove', { pointerId: 1, clientX: 5, clientY: 5 });
    expect(m.consumeDrag()).toEqual({ dx: 0, dy: 0 });       // pointer cleared
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
