export class InputMapper {
  private down = false;
  private dx = 0; private dy = 0;
  private wheel = 0;
  private readonly keys = new Set<string>();

  private readonly onDown = () => { this.down = true; };
  private readonly onUp = () => { this.down = false; };
  private readonly onMove = (e: PointerEvent) => {
    if (this.down) { this.dx += e.movementX ?? 0; this.dy += e.movementY ?? 0; }
  };
  private readonly onWheel = (e: WheelEvent) => { this.wheel += e.deltaY ?? 0; };
  private readonly onKeyDown = (e: KeyboardEvent) => { this.keys.add(e.code); };
  private readonly onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };

  constructor(private readonly target: HTMLElement) {
    target.addEventListener('pointerdown', this.onDown as EventListener);
    target.addEventListener('pointerup', this.onUp as EventListener);
    target.addEventListener('pointercancel', this.onUp as EventListener);
    target.addEventListener('pointermove', this.onMove as EventListener);
    target.addEventListener('wheel', this.onWheel as EventListener);
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
  }

  consumeDrag(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy }; this.dx = 0; this.dy = 0; return d;
  }
  consumeWheel(): number { const w = this.wheel; this.wheel = 0; return w; }
  movement(): { forward: number; right: number } {
    return {
      forward: (this.keys.has('KeyW') ? 1 : 0) - (this.keys.has('KeyS') ? 1 : 0),
      right: (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0),
    };
  }
  dispose(): void {
    this.target.removeEventListener('pointerdown', this.onDown as EventListener);
    this.target.removeEventListener('pointerup', this.onUp as EventListener);
    this.target.removeEventListener('pointercancel', this.onUp as EventListener);
    this.target.removeEventListener('pointermove', this.onMove as EventListener);
    this.target.removeEventListener('wheel', this.onWheel as EventListener);
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
  }
}
