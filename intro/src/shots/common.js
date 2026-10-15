import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { config } from '../config.js';
import { darkGloss, FACE } from '../assets.js';

export const W = config.width;
export const H = config.height;

export function baseScene(env, intensity = 1) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.environment = env;
  scene.environmentIntensity = intensity;
  return scene;
}

export function camera(fov = 30, near = 0.05, far = 400) {
  return new THREE.PerspectiveCamera(fov, W / H, near, far);
}

// The hero object: a 16:10 slab of black glass on a dark anodised body.
export const SLAB = { w: 3.2, h: 2.0, d: 0.07 };

const screenMat = (map, intensity) =>
  new THREE.MeshPhysicalMaterial({
    color: 0x000000,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    emissive: map ? 0xffffff : 0x000000,
    emissiveMap: map ?? null,
    emissiveIntensity: intensity,
  });

export function makeSlab({ screen = null, intensity = 1, body = {} } = {}) {
  const group = new THREE.Group();
  const bodyMesh = new THREE.Mesh(
    new RoundedBoxGeometry(SLAB.w, SLAB.h, SLAB.d, 4, 0.022),
    darkGloss({ color: 0x0c0c0d, metalness: 0.7, roughness: 0.32, clearcoat: 0.4, ...body })
  );
  const face = new THREE.Mesh(new THREE.PlaneGeometry(SLAB.w - 0.012, SLAB.h - 0.012), screenMat(screen, intensity));
  face.position.z = SLAB.d / 2 + 0.0008;
  group.add(bodyMesh, face);
  return { group, body: bodyMesh, face, faceMat: face.material };
}

/** Face unit coords (u 0..1.6 right, v 0..1 down) to slab-local position on the glass. */
export function faceLocal(u, v, z = SLAB.d / 2 + 0.002) {
  return new THREE.Vector3((u / FACE.u - 0.5) * SLAB.w, (0.5 - v) * SLAB.h, z);
}

/** Projects a world-space point to overlay pixels. */
export function toScreen(v, cam) {
  const p = v.clone().project(cam);
  return { x: (p.x + 1) * 0.5 * W, y: (1 - p.y) * 0.5 * H, z: p.z };
}

/** Projects a face coordinate of `obj` (slab group) to overlay pixels. */
export function faceToScreen(obj, cam, u, v) {
  obj.updateMatrixWorld(true);
  return toScreen(faceLocal(u, v).applyMatrix4(obj.matrixWorld), cam);
}

/**
 * Instanced slabs: dark body plus an emissive screen that samples one tile of the
 * site atlas per instance. Per-instance colour scales screen brightness.
 */
export function makePanels(count, atlas, { w = SLAB.w, h = SLAB.h, d = SLAB.d, screen = 0.9 } = {}) {
  const bodyGeo = new RoundedBoxGeometry(w, h, d, 2, 0.022);
  const screenGeo = new THREE.PlaneGeometry(w - 0.012, h - 0.012);
  screenGeo.translate(0, 0, d / 2 + 0.0015);
  const tileAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  screenGeo.setAttribute('aTile', tileAttr);

  const bodyMat = darkGloss({ color: 0x0c0c0d, metalness: 0.7, roughness: 0.32, clearcoat: 0.4 });
  const sMat = screenMat(null, 1);
  sMat.emissive.set(0xffffff);
  const uniforms = { uAtlas: { value: atlas }, uScreen: { value: screen }, uTime: { value: 0 }, uInvert: { value: 0 } };
  // Instance colour: r = screen brightness, g = how far the site has degraded into a mosaic.
  sMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTile;\nvarying vec2 vTileUv;')
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvTileUv = (uv + vec2(mod(aTile, 4.0), 3.0 - floor(aTile / 4.0))) * 0.25;'
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vTileUv;\nuniform sampler2D uAtlas;\nuniform float uScreen, uTime, uInvert;'
      )
      .replace(
        '#include <emissivemap_fragment>',
        `vec2 tuv = vTileUv;
        #ifdef USE_COLOR
          if (vColor.g > 0.001) {
            vec2 base = floor(vTileUv * 4.0) / 4.0;
            float cells = mix(160.0, 5.0, pow(vColor.g, 0.6));
            vec2 local = (vTileUv - base) * 4.0;
            local = (floor(local * vec2(cells, cells * 0.625)) + 0.5) / vec2(cells, cells * 0.625);
            tuv = base + local / 4.0;
          }
        #endif
        vec3 site = texture2D(uAtlas, tuv).rgb;
        site = mix(site, vec3(0.85) - site * 0.85, uInvert);
        #ifdef USE_COLOR
          totalEmissiveRadiance = site * vColor.r * uScreen;
        #else
          totalEmissiveRadiance = site * uScreen;
        #endif`
      );
  };

  const body = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  const scr = new THREE.InstancedMesh(screenGeo, sMat, count);
  scr.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
  body.frustumCulled = false;
  scr.frustumCulled = false;
  const group = new THREE.Group();
  group.add(body, scr);

  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  const one = new THREE.Vector3(1, 1, 1);
  return {
    group,
    uniforms,
    bodyMat,
    screenMat: sMat,
    set(i, pos, quat, tile = 0, bright = 1, noise = 0) {
      m.compose(pos, quat, one);
      body.setMatrixAt(i, m);
      scr.setMatrixAt(i, m);
      tileAttr.setX(i, tile);
      c.setRGB(bright, noise, 0);
      scr.setColorAt(i, c);
    },
    commit() {
      body.instanceMatrix.needsUpdate = true;
      scr.instanceMatrix.needsUpdate = true;
      scr.instanceColor.needsUpdate = true;
      tileAttr.needsUpdate = true;
    },
  };
}

/** Soft contact shadow: a transparent plane with a radial falloff. */
export function contactShadow(size = 1, strength = 0.6) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const mat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
}
