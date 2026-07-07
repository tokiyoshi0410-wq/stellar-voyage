// 二本指ピンチの純粋計算。

/** 2つのタッチ点の距離（px）。 */
export function pinchDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/**
 * 二本指の距離が prev→cur に変化したときの nav.zoom() 係数（乗算）。
 * 指を広げる(cur>prev)＝ズームイン(<1)、狭める(cur<prev)＝ズームアウト(>1)。
 * ホイールと同じく viewDistance に掛けるので、広げる=近づく。
 */
export function pinchZoomFactor(prevDist: number, curDist: number): number {
  if (prevDist <= 0 || curDist <= 0) return 1;
  return prevDist / curDist;
}
