varying vec3 vColor;

void main() {
  vec2 uv = gl_PointCoord - vec2(0.5);
  float d = length(uv);
  float alpha = 1.0 - smoothstep(0.0, 0.5, d);
  gl_FragColor = vec4(vColor, alpha);
}
