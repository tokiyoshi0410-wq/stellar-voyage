import { describe, it, expect } from 'vitest';
import { LightPulseSphere } from '../../src/edu/LightPulseSphere';

describe('LightPulseSphere', () => {
  it('starts hidden, scales the sphere to the radius, toggles visibility, disposes', () => {
    const p = new LightPulseSphere();
    expect(p.object.visible).toBe(false);
    p.setVisible(true);
    expect(p.object.visible).toBe(true);
    p.update(12);
    expect(p.object.scale.x).toBeCloseTo(12, 5);
    expect(() => p.dispose()).not.toThrow();
  });
});
