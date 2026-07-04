// Ballesteros (2012) の B-V → 実効温度近似
export function bvToTemperature(bv: number): number {
  const t = 0.92 * bv;
  return 4600 * (1 / (t + 1.7) + 1 / (t + 0.62));
}

// Tanner Helland の黒体色近似（0..1 正規化）
export function temperatureToRGB(kelvin: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number, g: number, b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const clamp = (x: number) => Math.max(0, Math.min(255, x)) / 255;
  return [clamp(r), clamp(g), clamp(b)];
}

export function bvToRGB(bv: number): [number, number, number] {
  return temperatureToRGB(bvToTemperature(bv));
}
