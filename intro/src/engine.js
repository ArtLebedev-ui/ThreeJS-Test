import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    tOv: { value: null },
    tOvD: { value: null },
    uRes: { value: new THREE.Vector2() },
    uFrame: { value: 0 },
    uExposure: { value: 1 },
    uFade: { value: 1 },
    uFlash: { value: 0 },
    uCA: { value: 1 },
    uGrain: { value: 0.045 },
    uVignette: { value: 0.55 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse, tOv, tOvD;
    uniform vec2 uRes;
    uniform float uFrame, uExposure, uFade, uFlash, uCA, uGrain, uVignette;
    varying vec2 vUv;

    vec3 aces(vec3 x) {
      const mat3 m1 = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
      const mat3 m2 = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
      vec3 v = m1 * x;
      vec3 a = v * (v + 0.0245786) - 0.000090537;
      vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
      return clamp(m2 * (a / b), 0.0, 1.0);
    }
    vec3 toSRGB(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    float hash(vec3 p) {
      p = fract(p * 0.1031);
      p += dot(p, p.zyx + 31.32);
      return fract((p.x + p.y) * p.z);
    }

    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      d.x *= uRes.x / uRes.y;
      float r2 = dot(d, d);
      vec2 off = (uv - 0.5) * r2 * 0.012 * uCA;
      vec3 hdr;
      hdr.r = texture2D(tDiffuse, uv - off).r;
      hdr.g = texture2D(tDiffuse, uv).g;
      hdr.b = texture2D(tDiffuse, uv + off).b;

      vec3 col = toSRGB(aces(hdr * uExposure));

      vec4 ovd = texture2D(tOvD, uv);
      col = mix(col, abs(ovd.rgb - col), ovd.a);
      vec4 ov = texture2D(tOv, uv);
      col = mix(col, ov.rgb, ov.a);

      col *= mix(1.0, smoothstep(1.25, 0.15, r2 * 2.2), uVignette);
      col = col * uFade + uFlash;

      float g = hash(vec3(gl_FragCoord.xy, mod(uFrame, 977.0) * 13.0)) - 0.5;
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col += g * uGrain * (0.35 + 0.65 * (1.0 - abs(lum - 0.45) * 1.6));
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `,
};

const AccumShader = {
  uniforms: { tSrc: { value: null }, uWeight: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D tSrc; uniform float uWeight; varying vec2 vUv;
    void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb * uWeight, 1.0); }`,
};

export class Engine {
  constructor(canvas, { width: ovW, height: ovH, fps }, scale = 1) {
    // The 2D overlay always runs at full resolution; `scale` only affects the 3D render.
    this.ovW = ovW;
    this.ovH = ovH;
    const width = Math.round(ovW * scale);
    const height = Math.round(ovH * scale);
    this.width = width;
    this.height = height;
    this.fps = fps;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = true;
    this.renderer = renderer;

    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true };
    this.sceneRT = new THREE.WebGLRenderTarget(width, height, { ...rtOpts, samples: 4 });
    this.accumRT = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, depthBuffer: false });

    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.accumMat = new THREE.ShaderMaterial({
      ...AccumShader,
      uniforms: THREE.UniformsUtils.clone(AccumShader.uniforms),
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.accumMat);
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);

    this.composer = new EffectComposer(
      renderer,
      new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType })
    );
    this.composer.setPixelRatio(1);
    this.composer.setSize(width, height);
    this.texPass = new TexturePass(this.accumRT.texture);
    this.composer.addPass(this.texPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.6, 0.55, 0.82);
    this.composer.addPass(this.bloom);
    this.final = new ShaderPass(FinalShader);
    this.final.uniforms.uRes.value.set(width, height);
    this.composer.addPass(this.final);

    this.ov = this.makeOverlay();
    this.ovD = this.makeOverlay();
    this.final.uniforms.tOv.value = this.ov.tex;
    this.final.uniforms.tOvD.value = this.ovD.tex;
  }

  makeOverlay() {
    const canvas = document.createElement('canvas');
    canvas.width = this.ovW;
    canvas.height = this.ovH;
    // A CPU-backed canvas: uploading a GPU-accelerated canvas every frame left stale tiles in the texture.
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return { canvas, ctx, tex };
  }

  /**
   * Renders one output frame. `drawScene(t)` must position everything for time t
   * and return { scene, camera }. Multiple sub-frames are averaged for motion blur.
   */
  render({ t, frame, samples = 1, shutter = 0.5, drawScene, drawOverlay, post = {} }) {
    const r = this.renderer;
    const n = Math.max(1, samples | 0);
    for (let k = 0; k < n; k++) {
      const tk = n === 1 ? t : t + ((k + 0.5) / n - 0.5) * (shutter / this.fps);
      const { scene, camera } = drawScene(tk);
      r.setRenderTarget(this.sceneRT);
      r.clear();
      r.render(scene, camera);
      this.accumMat.uniforms.tSrc.value = this.sceneRT.texture;
      this.accumMat.uniforms.uWeight.value = 1 / n;
      r.setRenderTarget(this.accumRT);
      if (k === 0) r.clear();
      r.autoClear = false;
      r.render(this.quadScene, this.quadCam);
      r.autoClear = true;
    }
    r.setRenderTarget(null);

    for (const o of [this.ov, this.ovD]) o.ctx.clearRect(0, 0, this.ovW, this.ovH);
    drawOverlay(this.ov.ctx, this.ovD.ctx, t);
    this.ov.tex.needsUpdate = true;
    this.ovD.tex.needsUpdate = true;

    const u = this.final.uniforms;
    u.uFrame.value = frame;
    u.uExposure.value = post.exposure ?? 1;
    u.uFade.value = post.fade ?? 1;
    u.uFlash.value = post.flash ?? 0;
    u.uCA.value = post.ca ?? 1;
    u.uGrain.value = post.grain ?? 0.045;
    u.uVignette.value = post.vignette ?? 0.55;
    this.bloom.strength = post.bloom ?? 0.6;
    this.bloom.radius = post.bloomRadius ?? 0.55;
    this.bloom.threshold = post.bloomThreshold ?? 0.82;
    this.composer.render();
  }
}

/** Dark studio light rigs baked into PMREM environment maps for glossy reflections. */
export function createEnvironments(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const strip = (w, h, intensity, color = 0xffffff) => {
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    m.color.multiplyScalar(intensity);
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  };
  const place = (mesh, pos, look = [0, 0, 0]) => {
    mesh.position.set(...pos);
    mesh.lookAt(...look);
    return mesh;
  };

  const build = (items) => {
    const s = new THREE.Scene();
    s.background = new THREE.Color(0x000000);
    items.forEach((i) => s.add(i));
    const tex = pmrem.fromScene(s, 0, 0.1, 100).texture;
    s.traverse((o) => o.geometry && o.geometry.dispose());
    return tex;
  };

  const studio = build([
    place(strip(8, 3, 1.8), [0, 6, 0.5]),
    place(strip(0.35, 9, 9), [-6, 0.5, 1]),
    place(strip(0.22, 9, 6, 0xdfe8ff), [6, 0.5, -2]),
    place(strip(12, 0.14, 10), [0, 1.2, -7]),
    place(strip(7, 2.5, 0.55), [1.5, 3.8, 6]),
    place(strip(0.12, 6, 4), [-2.5, -1, 6.5]),
  ]);

  const hairline = build([
    place(strip(0.12, 14, 22), [-5, 0, 2]),
    place(strip(14, 0.08, 14), [0, 4, -5]),
    place(strip(3, 3, 0.05), [0, 0, 6]),
  ]);

  const soft = build([
    place(strip(10, 4, 1.2), [0, 6, 0]),
    place(strip(1.2, 8, 3.5), [-6, 1, 2]),
    place(strip(1.2, 8, 2.0, 0xd8e2ff), [6, 1, 2]),
    place(strip(12, 3, 0.25), [0, -1, -7]),
  ]);

  const front = build([
    place(strip(8, 3, 1.4), [0, 6, 0.5]),
    place(strip(0.35, 9, 8), [-6, 0.5, 1]),
    place(strip(0.22, 9, 5, 0xdfe8ff), [6, 0.5, -2]),
    place(strip(12, 0.14, 8), [0, 1.2, -7]),
    place(strip(12, 5, 0.32), [0, 3.5, 8]),
    place(strip(12, 0.1, 6), [0, -2.2, 7]),
  ]);

  pmrem.dispose();
  return { studio, hairline, soft, front };
}
