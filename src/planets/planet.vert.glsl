varying vec3 vNormalW;  // ワールド空間の法線（ライティング用）
varying vec3 vWorldPos; // ワールド空間の位置（視線ベクトル用）
varying vec3 vPos;      // オブジェクト空間の位置（表面ノイズ用）
void main() {
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
