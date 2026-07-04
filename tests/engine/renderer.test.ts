import { describe, it, expect, vi } from 'vitest';

describe('isWebGL2Available', () => {
  it('returns false when getContext yields null', async () => {
    const { isWebGL2Available } = await import('../../src/engine/Renderer');
    const canvas = { getContext: vi.fn().mockReturnValue(null) } as unknown as HTMLCanvasElement;
    expect(isWebGL2Available(canvas)).toBe(false);
  });

  it('returns true when webgl2 context exists', async () => {
    const { isWebGL2Available } = await import('../../src/engine/Renderer');
    const canvas = { getContext: vi.fn().mockReturnValue({}) } as unknown as HTMLCanvasElement;
    expect(isWebGL2Available(canvas)).toBe(true);
  });
});
