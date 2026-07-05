uniform vec3 uFocusPc;
uniform float uScaleAuPerPc;
uniform vec3 uCameraAu;
uniform float uPixelScale;
attribute float size;
varying vec3 vColor;

void main() {
  vColor = color;
  vec3 rel = (position - uFocusPc) * uScaleAuPerPc - uCameraAu;
  vec4 mv = modelViewMatrix * vec4(rel, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size * uPixelScale / max(-mv.z, 0.001);
  gl_PointSize = clamp(gl_PointSize, 1.0, 24.0);
}
