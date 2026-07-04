import { describe, it, expect, beforeEach } from 'vitest';
import { InputController, THROTTLE_RATE } from '../../src/flight/InputController';

function makeTarget() {
  const listeners: Record<string, ((e: any) => void)[]> = {};
  return {
    el: {
      addEventListener: (t: string, cb: any) => { (listeners[t] ??= []).push(cb); },
      removeEventListener: () => {},
    } as unknown as HTMLElement,
    fire: (t: string, e: any) => { (listeners[t] ?? []).forEach((cb) => cb(e)); },
  };
}

describe('InputController.applyThrottle', () => {
  let target: ReturnType<typeof makeTarget>;
  let input: InputController;
  beforeEach(() => { target = makeTarget(); input = new InputController(target.el); });

  it('increases throttle while W is held', () => {
    target.fire('keydown', { code: 'KeyW' });
    const next = input.applyThrottle(0.5, 0.5);
    expect(next).toBeCloseTo(0.5 + THROTTLE_RATE * 0.5, 5);
  });

  it('decreases while S is held and clamps at 0', () => {
    target.fire('keydown', { code: 'KeyS' });
    expect(input.applyThrottle(0.1, 1)).toBe(0);
  });

  it('clamps at 1', () => {
    target.fire('keydown', { code: 'KeyW' });
    expect(input.applyThrottle(0.95, 1)).toBe(1);
  });

  it('holds throttle when no key is pressed', () => {
    expect(input.applyThrottle(0.42, 1)).toBe(0.42);
  });
});

describe('InputController.consumePointerDelta', () => {
  it('accumulates and resets pointer movement', () => {
    const target = makeTarget();
    const input = new InputController(target.el);
    target.fire('pointermove', { movementX: 3, movementY: -2 });
    target.fire('pointermove', { movementX: 1, movementY: 1 });
    expect(input.consumePointerDelta()).toEqual({ dx: 4, dy: -1 });
    expect(input.consumePointerDelta()).toEqual({ dx: 0, dy: 0 });
  });
});
