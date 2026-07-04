export const THROTTLE_RATE = 0.4; // throttle 変化率 [/s]

export class InputController {
  private readonly keys = new Set<string>();
  private pointerDx = 0;
  private pointerDy = 0;

  private readonly onKeyDown = (e: KeyboardEvent) => { this.keys.add(e.code); };
  private readonly onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  private readonly onPointerMove = (e: PointerEvent) => {
    this.pointerDx += e.movementX ?? 0;
    this.pointerDy += e.movementY ?? 0;
  };

  constructor(private readonly target: HTMLElement) {
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
    target.addEventListener('pointermove', this.onPointerMove as EventListener);
  }

  applyThrottle(current: number, dtSeconds: number): number {
    let next = current;
    if (this.keys.has('KeyW')) next += THROTTLE_RATE * dtSeconds;
    if (this.keys.has('KeyS')) next -= THROTTLE_RATE * dtSeconds;
    return Math.max(0, Math.min(1, next));
  }

  consumePointerDelta(): { dx: number; dy: number } {
    const d = { dx: this.pointerDx, dy: this.pointerDy };
    this.pointerDx = 0;
    this.pointerDy = 0;
    return d;
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
    this.target.removeEventListener('pointermove', this.onPointerMove as EventListener);
  }
}
