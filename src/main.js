const canvas = document.getElementById("grain");
const gl = canvas.getContext("webgl");

if (!gl) {
  throw new Error("WebGL not supported in this browser.");
}

const vertexSource = `
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentSource = `
  precision highp float;

  uniform vec2 u_resolution;
  uniform float u_time;

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
           (c - a) * u.y * (1.0 - u.x) +
           (d - b) * u.x * u.y;
  }

  float fbm(vec2 st) {
    float value = 0.0;
    float amplitude = 0.5;
    mat2 rot = mat2(0.84147, -0.54030, 0.54030, 0.84147);

    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(st);
      st = rot * st * 1.6 + 0.15;
      amplitude *= 0.5;
    }
    return value;
  }

  vec3 softBackdrop(vec2 uv, float time) {
    vec2 aspectUv = vec2(uv.x * (u_resolution.x / u_resolution.y), uv.y);
    vec2 centered = aspectUv - 0.5;

    float vignette = smoothstep(1.05, 0.35, length(centered));

    float drift = fbm(uv * 1.35 + vec2(time * 0.006, -time * 0.004));
    float fold = fbm(vec2(uv.y + time * 0.01, uv.x * 0.8 - time * 0.012));

    vec3 upper = vec3(0.08, 0.08, 0.085);
    vec3 lower = vec3(0.03, 0.031, 0.035);
    vec3 base = mix(upper, lower, uv.y + 0.015 * sin(time * 0.05));

    vec3 accent = vec3(0.14, 0.14, 0.15);
    float foldMask = smoothstep(0.2, 0.85, uv.x + fold * 0.2);
    vec3 layered = mix(base, accent, foldMask * 0.35);

    float grain = noise(uv * 70.0 + time * 0.25);
    float micro = noise((uv + 4.0) * 9.0 - time * 0.04);
    float softNoise = mix(grain, micro, 0.4);

    vec3 color = layered + vec3(drift * 0.05);
    color += vec3(softNoise * 0.02);
    color = mix(color, base, 0.65);
    color *= mix(0.88, 1.02, vignette);

    return clamp(color, 0.0, 1.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec3 color = softBackdrop(uv, u_time);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function compileShader(src, type) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${error}`);
  }
  return shader;
}

const vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
const fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

const program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(`Program failed to link: ${gl.getProgramInfoLog(program)}`);
}

gl.useProgram(program);

const quad = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
  gl.STATIC_DRAW
);

const aPosition = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

const uResolution = gl.getUniformLocation(program, "u_resolution");
const uTime = gl.getUniformLocation(program, "u_time");

function resizeCanvas() {
  const { innerWidth, innerHeight, devicePixelRatio } = window;
  const width = Math.floor(innerWidth * devicePixelRatio);
  const height = Math.floor(innerHeight * devicePixelRatio);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  canvas.style.width = `${innerWidth}px`;
  canvas.style.height = `${innerHeight}px`;
  gl.viewport(0, 0, width, height);
  gl.uniform2f(uResolution, width, height);
}

let start = performance.now();

function render(now) {
  const elapsed = (now - start) * 0.001;
  gl.uniform1f(uTime, elapsed);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  requestAnimationFrame(render);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);
requestAnimationFrame(render);
