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

  vec3 filmGrain(vec2 uv, float time) {
    float vignette = smoothstep(1.2, 0.2, distance(uv, vec2(0.5)));

    float n1 = noise(uv * 120.0 + time * 0.5);
    float n2 = noise(uv * 40.0 - time * 0.25);
    float n3 = noise(uv * 8.0 + sin(time * 0.2));

    float grain = n1 * 0.65 + n2 * 0.25 + n3 * 0.1;

    float scan = sin((uv.y + time * 0.1) * 300.0) * 0.025;

    vec3 base = mix(vec3(0.04, 0.05, 0.09), vec3(0.12, 0.13, 0.2), uv.y);
    vec3 tinted = base + vec3(0.02, 0.01, -0.01) * smoothstep(0.0, 1.0, uv.y);

    vec3 color = tinted + vec3(grain * 0.12 + scan);
    color *= mix(0.6, 1.1, vignette);

    return clamp(color, 0.0, 1.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    uv.x *= u_resolution.x / u_resolution.y;

    vec3 color = filmGrain(uv, u_time);
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
