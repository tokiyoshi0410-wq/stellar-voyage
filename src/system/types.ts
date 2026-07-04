export type PlanetType = 'rock' | 'ocean' | 'gas' | 'ice';

export interface Planet {
  name: string;
  type: PlanetType;
  semiMajorAxisAu: number;
  radiusEarth: number;
  massEarth: number;
  eqTempK: number | null;
  inHabitableZone: boolean;
  isReal: boolean;
  estimated: boolean;
  hasRing?: boolean;
}

export interface StellarSystem {
  starIndex: number;
  starName: string;
  spectralClass: string;
  temperatureK: number;
  luminositySun: number;
  planets: Planet[];
}
