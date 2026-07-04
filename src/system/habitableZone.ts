export function habitableZone(luminositySun: number): { inner: number; outer: number } {
  return {
    inner: Math.sqrt(luminositySun / 1.1),
    outer: Math.sqrt(luminositySun / 0.53),
  };
}

export function inHabitableZone(semiMajorAxisAu: number, luminositySun: number): boolean {
  const { inner, outer } = habitableZone(luminositySun);
  return semiMajorAxisAu >= inner && semiMajorAxisAu <= outer;
}
