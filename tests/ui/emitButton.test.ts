import { describe, it, expect, vi } from 'vitest';
import { EmitButton } from '../../src/ui/EmitButton';

describe('EmitButton', () => {
  it('fires onEmit exactly once per click', () => {
    const root = document.createElement('div');
    const onEmit = vi.fn();
    new EmitButton(root, onEmit);
    root.querySelector('button')!.click();
    expect(onEmit).toHaveBeenCalledTimes(1);
  });
});
