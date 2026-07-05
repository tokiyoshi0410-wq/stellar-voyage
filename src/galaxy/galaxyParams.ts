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

export const MILKY_WAY: GalaxyParams = {
  count: 8000, radiusAu: 4e9, armCount: 2, windings: 2.5, thicknessAu: 3e8,
  bulgeFraction: 0.15, coreColor: [1.0, 0.95, 0.8], armColor: [0.7, 0.8, 1.0],
};

export const ANDROMEDA: GalaxyParams = {
  count: 12000, radiusAu: 8e9, armCount: 2, windings: 3.0, thicknessAu: 5e8,
  bulgeFraction: 0.18, coreColor: [1.0, 0.9, 0.7], armColor: [0.8, 0.85, 1.0],
};

/** 天の川中心からアンドロメダ中心までの概念距離（天の川直径 8e9 の約3倍先） */
export const ANDROMEDA_OFFSET_AU = 2.4e10;
