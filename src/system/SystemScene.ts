import * as THREE from 'three';
import type { StellarSystem, PlanetType } from './types';
import { orbitPosition, planetPhase } from './orbit';

export function planetTypeColor(type: PlanetType): number {
  switch (type) {
    case 'rock': return 0xb08060;
    case 'ocean': return 0x3a6ea5;
    case 'gas': return 0xd9a066;
    case 'ice': return 0xbfe0e5;
  }
}

// 惑星スフィアの見かけ半径（AU）。実サイズは極小なので誇張する。
function planetDisplayRadius(radiusEarth: number): number {
  return 0.02 + Math.min(radiusEarth, 12) * 0.01;
}

export class SystemScene {
  readonly root = new THREE.Group();
  readonly planetMeshes: THREE.Mesh[] = [];

  constructor(readonly system: StellarSystem) {
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 32, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2cc }),
    );
    this.root.add(star);

    system.planets.forEach((p, i) => {
      const [x, y, z] = orbitPosition(p.semiMajorAxisAu, planetPhase(system.starIndex, i));
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(planetDisplayRadius(p.radiusEarth), 24, 16),
        new THREE.MeshStandardMaterial({ color: planetTypeColor(p.type) }),
      );
      mesh.position.set(x, y, z);
      mesh.userData.planetIndex = i;
      this.planetMeshes.push(mesh);
      this.root.add(mesh);

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(p.semiMajorAxisAu - 0.004, p.semiMajorAxisAu + 0.004, 128),
        new THREE.MeshBasicMaterial({ color: 0x2b4a7a, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.root.add(ring);
    });

    this.root.add(new THREE.PointLight(0xffffff, 2, 0, 0));
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
  }
}
