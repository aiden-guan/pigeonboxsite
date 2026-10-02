import * as THREE from '../vendor/three.min.js';

export function createSky(scene) {
  const uniforms = {
    uTop: { value: new THREE.Color('#6fa6db') },
    uHorizon: { value: new THREE.Color('#d6e8f0') },
    uSun: { value: new THREE.Color('#fff0d8') },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uNight: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uNight;
      varying vec3 vDir;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main() {
        vec3 d = normalize(vDir);
        float h = max(d.y, 0.0);
        vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
        col = mix(col, uHorizon * 0.85, smoothstep(0.0, -0.25, d.y));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        col += uSun * (pow(s, 4.0) * 0.42 + pow(s, 32.0) * 0.55 + smoothstep(0.9985, 0.9992, s) * 1.2);
        vec3 cell = floor(d * 260.0);
        float star = step(0.9975, hash(cell)) * smoothstep(0.05, 0.4, d.y) * uNight;
        col += vec3(star) * 0.9;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -1;
  scene.add(dome);
  return { dome, uniforms };
}
