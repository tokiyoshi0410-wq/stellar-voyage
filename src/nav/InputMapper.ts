import { pinchDistance, pinchZoomFactor } from './pinch';

export class InputMapper {
  // 現在押されているポインタ（マウス/指）を id → 直近位置で保持。
  // マウス movementX/Y はタッチで 0 になる端末があるため、位置差分で drag を出す（タッチ安全）。
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private dx = 0; private dy = 0;
  private wheel = 0;
  private pinch = 1;                       // 二本指ピンチの累積ズーム係数（consume でリセット）
  private prevPinchDist: number | null = null;
  private readonly keys = new Set<string>();
  private pauseToggleRequested = false;

  private readonly onDown = (e: PointerEvent) => {
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) this.prevPinchDist = this.currentPinchDistance();
  };
  private readonly onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.prevPinchDist = null; // 二本指が崩れたらピンチ終了
  };
  private readonly onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    // 一本指のときだけ視点ドラッグ（二本指中はピンチに専念）。
    if (this.pointers.size === 1) { this.dx += e.clientX - p.x; this.dy += e.clientY - p.y; }
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 2) {
      const dist = this.currentPinchDistance();
      if (this.prevPinchDist != null) this.pinch *= pinchZoomFactor(this.prevPinchDist, dist);
      this.prevPinchDist = dist;
    }
  };
  private readonly onWheel = (e: WheelEvent) => { this.wheel += e.deltaY ?? 0; };
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !this.keys.has('Space')) {
      this.pauseToggleRequested = true;
      e.preventDefault();
    }
    this.keys.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); };
  // window blur（alt-tab・別窓フォーカス）では keyup/pointerup を取り逃がすため、
  // 押下状態を全解除する。これがないと押しっぱなしのキー/ドラッグが復帰時に固着する。
  private readonly onBlur = () => { this.keys.clear(); this.pointers.clear(); this.prevPinchDist = null; };

  constructor(private readonly target: HTMLElement) {
    target.addEventListener('pointerdown', this.onDown as EventListener);
    target.addEventListener('pointerup', this.onUp as EventListener);
    target.addEventListener('pointercancel', this.onUp as EventListener);
    target.addEventListener('pointermove', this.onMove as EventListener);
    target.addEventListener('wheel', this.onWheel as EventListener);
    // Keyboard is inherently global: the canvas is not focusable/focused, so
    // keydown/keyup must bind to window rather than target (see task-6 fix report).
    window.addEventListener('keydown', this.onKeyDown as EventListener);
    window.addEventListener('keyup', this.onKeyUp as EventListener);
    window.addEventListener('blur', this.onBlur);
  }

  private currentPinchDistance(): number {
    const [a, b] = [...this.pointers.values()];
    if (!a || !b) return 0;
    return pinchDistance(a.x, a.y, b.x, b.y);
  }

  consumeDrag(): { dx: number; dy: number } {
    const d = { dx: this.dx, dy: this.dy }; this.dx = 0; this.dy = 0; return d;
  }
  consumeWheel(): number { const w = this.wheel; this.wheel = 0; return w; }
  consumePinch(): number { const p = this.pinch; this.pinch = 1; return p; }
  consumePauseToggle(): boolean {
    const v = this.pauseToggleRequested;
    this.pauseToggleRequested = false;
    return v;
  }
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
    window.removeEventListener('keydown', this.onKeyDown as EventListener);
    window.removeEventListener('keyup', this.onKeyUp as EventListener);
    window.removeEventListener('blur', this.onBlur);
  }
}
