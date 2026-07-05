uniform float uOpacity;
varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float alpha = 1.0 - smoothstep(0.0, 0.5, length(uv));
  gl_FragColor = vec4(vColor, alpha * uOpacity);
}
