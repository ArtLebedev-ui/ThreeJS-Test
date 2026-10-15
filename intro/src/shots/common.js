import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { config } from '../config.js';
import { darkGloss } from '../assets.js';

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

/**
 * Instanced "website" panels: a glossy dark slab plus an emissive screen that samples
 * one tile of the site atlas per instance. Per-instance colour scales screen brightness.
 */
export function makePanels(count, atlas, { w = 1.6, h = 1.0, d = 0.06, screen = 0.9 } = {}) {
  const bodyGeo = new RoundedBoxGeometry(w, h, d, 2, Math.min(d * 0.45, 0.03));
  const screenGeo = new THREE.PlaneGeometry(w * 0.965, h * 0.94);
  screenGeo.translate(0, 0, d / 2 + 0.0015);
  const tileAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
  screenGeo.setAttribute('aTile', tileAttr);

  const bodyMat = darkGloss({ color: 0x070708, roughness: 0.3 });
  const screenMat = new THREE.MeshPhysicalMaterial({
    color: 0x010101,
    roughness: 0.06,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    emissive: 0xffffff,
  });
  const uniforms = { uAtlas: { value: atlas }, uScreen: { value: screen } };
  screenMat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTile;\nvarying vec2 vTileUv;')
      .replace(
        '#include <uv_vertex>',
        '#include <uv_vertex>\nvTileUv = (uv + vec2(mod(aTile, 4.0), 3.0 - floor(aTile / 4.0))) * 0.25;'
      );
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTileUv;\nuniform sampler2D uAtlas;\nuniform float uScreen;')
      .replace(
        '#include <emissivemap_fragment>',
        `totalEmissiveRadiance = texture2D(uAtlas, vTileUv).rgb * uScreen;
        #ifdef USE_COLOR
          totalEmissiveRadiance *= vColor.rgb;
        #endif`
      );
  };

  const body = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
  const scr = new THREE.InstancedMesh(screenGeo, screenMat, count);
  scr.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
  body.frustumCulled = false;
  scr.frustumCulled = false;
  const group = new THREE.Group();
  group.add(body, scr);

  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  return {
    group,
    uniforms,
    bodyMat,
    screenMat,
    set(i, pos, quat, scale = 1, tile = 0, bright = 1) {
      m.compose(pos, quat, new THREE.Vector3(scale, scale, scale));
      body.setMatrixAt(i, m);
      scr.setMatrixAt(i, m);
      tileAttr.setX(i, tile);
      c.setScalar(bright);
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

/** Thin emissive bar used for light streaks and construction lines. */
export function lightBar(len, thick, intensity = 4, color = 0xffffff) {
  const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  mat.color.multiplyScalar(intensity);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, thick, thick), mat);
  return mesh;
}
