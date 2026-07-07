export interface GalaxyParams {
  count: number;
  radiusAu: number;
  armCount: number;
  windings: number;
  thicknessAu: number;
  bulgeFraction: number;
  coreColor: [number, number, number];
  armColor: [number, number, number];
}

// radiusAu は実スケール（1光年 = 63,241 AU）。直径がそのまま定規ラベル・教育パネルの数値に
// 一致するよう設定: 天の川 直径10万光年 → 半径5万光年 = 3.162e9 AU / アンドロメダ 直径20万光年。
export const MILKY_WAY: GalaxyParams = {
  count: 8000, radiusAu: 3.162e9, armCount: 2, windings: 2.5, thicknessAu: 2.4e8,
  bulgeFraction: 0.15, coreColor: [1.0, 0.95, 0.8], armColor: [0.7, 0.8, 1.0],
};
