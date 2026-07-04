export class FloatingOrigin {
  // JS number は float64。世界座標を倍精度で保持する。
  position: [number, number, number] = [0, 0, 0];

  setPosition(x: number, y: number, z: number): void {
    this.position[0] = x;
    this.position[1] = y;
    this.position[2] = z;
  }

  translate(dx: number, dy: number, dz: number): void {
    this.position[0] += dx;
    this.position[1] += dy;
    this.position[2] += dz;
  }

  relative(worldX: number, worldY: number, worldZ: number): [number, number, number] {
    return [
      worldX - this.position[0],
      worldY - this.position[1],
      worldZ - this.position[2],
    ];
  }
}
