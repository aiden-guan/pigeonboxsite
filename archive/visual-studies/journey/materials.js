import * as THREE from '../vendor/three.min.js';

export const shared = {
  uNight: { value: 0 },
  uTime: { value: 0 },
};

// Lambert with procedural windows in world space, so one instanced mesh
// can hold buildings of every size. Windows glow warmly after dusk.
export function windowMaterial({ spacing = [1.7, 2.3], glass = '#26384a', flat = false } = {}) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: false, flatShading: flat });
  mat.userData.window = { spacing, glass, flat };
  const glassColor = new THREE.Color(glass);
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = shared.uNight;
    shader.uniforms.uGlass = { value: glassColor };
    shader.uniforms.uSpacing = { value: new THREE.Vector2(...spacing) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPbWorld;\nvarying vec3 vPbNormal;\nvarying float vPbSeed;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 pbw = vec4(transformed, 1.0);
        vec3 pbn = objectNormal;
        #ifdef USE_INSTANCING
          pbw = instanceMatrix * pbw;
          pbn = mat3(instanceMatrix) * pbn;
          vPbSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
        #else
          vPbSeed = 0.5;
        #endif
        pbw = modelMatrix * pbw;
        vPbWorld = pbw.xyz;
        vPbNormal = normalize(mat3(modelMatrix) * pbn);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vPbWorld;
        varying vec3 vPbNormal;
        varying float vPbSeed;
        uniform float uNight;
        uniform vec3 uGlass;
        uniform vec2 uSpacing;
        float pbHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float pbWall = 1.0 - step(0.5, abs(vPbNormal.y));
        vec2 pbUv = vec2(dot(vPbWorld.xz, vec2(-vPbNormal.z, vPbNormal.x)), vPbWorld.y - 0.6);
        vec2 pbCell = pbUv / uSpacing;
        vec2 pbF = fract(pbCell);
        float pbWin = step(0.28, pbF.x) * step(pbF.x, 0.72) * step(0.3, pbF.y) * step(pbF.y, 0.8) * step(1.0, pbCell.y) * pbWall;
        float pbLit = step(0.42, pbHash(floor(pbCell) + vPbSeed * 37.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, pbWin * 0.78);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += pbWin * pbLit * uNight * vec3(1.0, 0.7, 0.36) * 1.6;`);
  };
  mat.customProgramCacheKey = () => `pb-windows-${spacing.join('-')}-${glass}-${flat}`;
  return mat;
}

let glowTexture;
export function glowMap() {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  return glowTexture;
}

// Repeated scenery keeps a cheap diffuse shader. Richer hero surfaces opt in.
export const lambert = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: false, ...extra });
export const stylizedMat = (color, extra = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.86, metalness: 0, flatShading: false, ...extra,
});
export const stylizedFlatMat = (color, extra = {}) => stylizedMat(color, { ...extra, flatShading: true });
export const emissiveMat = (color, intensity = 1, extra = {}) => stylizedMat(color, {
  emissive: color, emissiveIntensity: intensity, ...extra,
});
export const glassMat = (color = '#8caeb5', extra = {}) => stylizedMat(color, {
  roughness: 0.26, metalness: 0.18, ...extra,
});
export const foliageMat = (color = '#749263', extra = {}) => lambert(color, extra);
