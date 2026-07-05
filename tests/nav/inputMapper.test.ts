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
  it('maps WASD to forward/right', () => {
    const t = makeTarget(); const m = new InputMapper(t.el);
    t.fire('keydown', { code: 'KeyW' }); t.fire('keydown', { code: 'KeyD' });
    expect(m.movement()).toEqual({ forward: 1, right: 1 });
    t.fire('keydown', { code: 'KeyS' }); // W and S → forward 0
    expect(m.movement()).toEqual({ forward: 0, right: 1 });
    t.fire('keyup', { code: 'KeyD' });
    expect(m.movement()).toEqual({ forward: 0, right: 0 });
  });
});
