uniform int uType;      // 0 rock, 1 ocean, 2 gas, 3 ice
uniform float uSeed;
uniform vec3 uStarDir;  // ワールドでの恒星方向（正規化済み）
varying vec3 vNormalW;
varying vec3 vWorldPos;
varying vec3 vPos;

// 簡易ハッシュノイズ
float hash(vec3 p) {
  p = fract(p * 0.3183099 + uSeed);
  p += dot(p, p.yzx + 19.19);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 p) {
  vec3 i = floor(p); vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash(i);
  float n100 = hash(i + vec3(1,0,0));
  float n010 = hash(i + vec3(0,1,0));
  float n110 = hash(i + vec3(1,1,0));
  float n001 = hash(i + vec3(0,0,1));
  float n101 = hash(i + vec3(1,0,1));
  float n011 = hash(i + vec3(0,1,1));
  float n111 = hash(i + vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y),
             mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
  return v;
}

void main() {
  vec3 n = normalize(vNormalW);
  // 惑星ごとに変化する境界オフセット（整数シードを fract で小数化して座標に加算）
  vec3 seedOffset = vec3(fract(uSeed * 0.1031), fract(uSeed * 0.2417), fract(uSeed * 0.3719)) * 17.0;
  vec3 base;
  if (uType == 2) {              // gas: 帯状の縞
    float band = fbm(vec3(vPos.y * 8.0, 0.0, 0.0) + seedOffset);
    base = mix(vec3(0.85,0.62,0.38), vec3(0.95,0.85,0.6), band);
  } else if (uType == 1) {       // ocean: 青 + 雲
    float cloud = smoothstep(0.55, 0.8, fbm(vPos * 3.0 + seedOffset));
    base = mix(vec3(0.15,0.35,0.6), vec3(1.0), cloud);
  } else if (uType == 3) {       // ice: 白 + 亀裂
    float crack = smoothstep(0.5, 0.52, fbm(vPos * 6.0 + seedOffset));
    base = mix(vec3(0.8,0.9,0.95), vec3(0.5,0.7,0.85), crack);
  } else {                       // rock: クレーター風
    float r = fbm(vPos * 5.0 + seedOffset);
    base = mix(vec3(0.4,0.3,0.24), vec3(0.7,0.55,0.4), r);
  }
  // 恒星方向ライティング（昼夜、ワールド空間で統一）
  float lambert = clamp(dot(n, normalize(uStarDir)), 0.0, 1.0);
  vec3 col = base * (0.15 + 0.85 * lambert);
  // 大気フレネルリム（ワールド空間の視線ベクトル）
  vec3 viewDirW = normalize(cameraPosition - vWorldPos);
  float rim = pow(1.0 - clamp(dot(n, viewDirW), 0.0, 1.0), 3.0);
  col += rim * vec3(0.3,0.5,0.8) * (0.4 + 0.6 * lambert);
  gl_FragColor = vec4(col, 1.0);
}
