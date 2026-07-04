import * as THREE from 'three';

export function isWebGL2Available(canvas: HTMLCanvasElement): boolean {
  try {
    return canvas.getContext('webgl2') != null;
  } catch {
    return false;
  }
}

export class Renderer {
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  constructor(canvasParent: HTMLElement) {
    this.camera = new THREE.PerspectiveCamera(60, 1, 1e-5, 1e12);
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    canvasParent.appendChild(this.renderer.domElement);
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
