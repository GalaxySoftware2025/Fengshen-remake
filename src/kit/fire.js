// Real fire (the user's call, 磻溪 2026-10-19: not the original's pixel flames, nor flame tongues that read as
// triangles): wide upright sheets of flame, leaning toward the camera that looks down on them, their shape made by
// turbulent noise scrolling up and cut by a threshold that rises with height, so the body is solid low down and tears
// into licks and wisps above; a black-body ramp (deep red edges, orange, a yellow core) with warm, never dark, edges.
// Instanced: one draw for all the sheets of a fire. Used by the bamboo road's forest fire and the 演武場's braziers.
import * as THREE from 'three';

const FIRE_FS = `uniform float uTime; varying vec2 vUv; varying float vSeed, vHeat, vX;
  float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float fn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(fh(i), fh(i + vec2(1, 0)), f.x), mix(fh(i + vec2(0, 1)), fh(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += fn(p) * a; p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  vec3 ramp(float h){ vec3 c = mix(vec3(0.35, 0.03, 0.0), vec3(0.9, 0.16, 0.01), smoothstep(0.0, 0.25, h));
    c = mix(c, vec3(1.0, 0.45, 0.04), smoothstep(0.25, 0.55, h)); c = mix(c, vec3(1.0, 0.75, 0.25), smoothstep(0.55, 0.8, h));
    return mix(c, vec3(1.0, 0.95, 0.75), smoothstep(0.85, 1.1, h)); }
  void main(){
    float t = mod(uTime, 600.0), y = vUv.y, x = vUv.x - 0.5;
    vec2 p = vec2(vX + x * 1.5, y * 1.5 - t * 1.5);                                        // rushing up
    vec2 q = vec2(fbm(p * 1.1 + vSeed), fbm(p * 1.1 + vSeed + 4.3));                           // turbulence
    float n = fbm(p * vec2(2.8, 2.0) + (q - 0.5) * 2.2);
    n = clamp((n - 0.5) * 2.6 + 0.5, 0.0, 1.0);                                               // strong contrast: torn into licks
    float sway = (q.x - 0.5) * 0.45 * y + sin(t * 2.3 + vSeed) * 0.04 * y;
    float w = mix(0.48, 0.2, y) * (0.8 + 0.5 * q.y);                                            // a body that wobbles, narrower up
    float env = 1.0 - smoothstep(w * 0.35, w, abs(x + sway));
    float f = env * (n * 1.5 - y * 1.05 + 0.22);
    f *= smoothstep(0.0, 0.26, y) * (1.0 - smoothstep(0.62, 0.97, y)) * vHeat;   // (never a hard edge at the sheet's foot or top)
    float a = smoothstep(0.04, 0.35, f);
    vec3 col = ramp(f * 1.15);
    gl_FragColor = vec4(col * a, a * 0.9);
    #include <colorspace_fragment>
  }`;
// sheets(S, max): the fire's mesh in scene S; set(list) lays the sheets out, each [x, y, z, height, seed, heat, width]
// (its foot at x, y, z; heat about 1: how far it burns up its height); tick(t) moves them
export function sheets(S, max = 700) {
  const base = new THREE.PlaneGeometry(1, 1); base.translate(0, 0.5, 0);
  const geo = new THREE.InstancedBufferGeometry(); geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv);
  const aPos = new Float32Array(max * 4), aInfo = new Float32Array(max * 3);
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(aPos, 4).setUsage(THREE.DynamicDrawUsage)); geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(aInfo, 3).setUsage(THREE.DynamicDrawUsage));
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uTime: { value: 0 } },
    vertexShader: `attribute vec4 iPos; attribute vec3 iInfo; varying vec2 vUv; varying float vSeed, vHeat, vX;
      void main(){ vUv = uv; vSeed = iInfo.x; vHeat = iInfo.y; vX = iPos.z * 0.8 + iInfo.x;
        vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]), camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
        vec3 up = normalize(mix(vec3(0.0, 1.0, 0.0), camUp, 0.4));   // leaning toward the camera, which looks down on them: not squashed
        vec3 w = iPos.xyz + right * position.x * iInfo.z + up * position.y * iPos.w;   // (iInfo.z: width, iPos.w: height)
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
    fragmentShader: FIRE_FS,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 6; mesh.userData.noRange = true; S.add(mesh);
  return {
    mesh, mat,
    set(list) {
      const n = Math.min(max, list.length);
      for (let i = 0; i < n; i++) { const [x, y, z, h, seed, heat, w] = list[i]; aPos.set([x, y, z, h], i * 4); aInfo.set([seed, heat, w], i * 3); }
      geo.instanceCount = n; geo.attributes.iPos.needsUpdate = true; geo.attributes.iInfo.needsUpdate = true;
    },
    tick(t) { mat.uniforms.uTime.value = t; },
  };
}
