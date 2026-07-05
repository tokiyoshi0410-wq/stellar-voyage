uniform float uPixelScale;
attribute float size;
varying vec3 vColor;

void main() {
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(size * uPixelScale / max(-mv.z, 0.001), 1.0, 24.0);
}
