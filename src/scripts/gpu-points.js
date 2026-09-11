// Runs in a rendering worker. Context creation, shader compilation and drawing
// buffer allocation may block the driver, but must not block page input.
const VERTEX = `
attribute vec2 a_position;
attribute float a_radius;
attribute vec4 a_colour;
attribute float a_detail;
attribute float a_seed;
uniform vec2 u_viewport;
uniform float u_dpr;
uniform float u_detail_pass;
varying vec4 v_colour;
varying float v_radius;
varying float v_size;
varying float v_square;
float random(float value) {
  return fract(sin(value * 91.733 + 17.17) * 43758.5453);
}
void main() {
  vec2 position = a_position;
  float radiusScale = 1.0;
  float alphaScale = 1.0;
  vec3 colour = a_colour.rgb;
  if (u_detail_pass > 0.5) {
    float angle = random(a_seed * 809.0 + u_detail_pass * 37.0) * 6.2831853;
    float distance = 1.2 + u_detail_pass * 0.85 + random(a_seed * 313.0 + u_detail_pass * 71.0) * 1.7;
    position += vec2(cos(angle), sin(angle)) * distance;
    radiusScale = max(0.32, 0.68 - u_detail_pass * 0.12);
    alphaScale = a_detail * max(0.18, 0.52 - u_detail_pass * 0.11);
    vec3 tint = u_detail_pass < 1.5 ? vec3(1.0, 0.86, 0.58)
      : u_detail_pass < 2.5 ? vec3(0.55, 0.78, 1.0) : vec3(1.0, 0.94, 0.78);
    colour = mix(colour, tint, 0.16);
  }
  gl_Position = vec4(position / u_viewport * vec2(2.0, -2.0) + vec2(-1.0, 1.0), 0.0, 1.0);
  v_radius = abs(a_radius) * radiusScale * u_dpr;
  v_size = max(1.0, v_radius * 2.0 + 2.0);
  gl_PointSize = v_size;
  v_square = a_radius < 0.0 ? 1.0 : 0.0;
  v_colour = vec4(colour, a_colour.a * alphaScale);
}`;
const FRAGMENT = `
precision mediump float;
varying vec4 v_colour;
varying float v_radius;
varying float v_size;
varying float v_square;
void main() {
  if (v_colour.a <= 0.001) discard;
  vec2 p = abs(gl_PointCoord - vec2(0.5)) * v_size;
  float distance = mix(length(p), max(p.x, p.y), v_square);
  float alpha = clamp(v_radius + 0.5 - distance, 0.0, 1.0) * v_colour.a;
  gl_FragColor = vec4(v_colour.rgb, alpha);
}`;

export function createGpuPointRenderer(canvas) {
  const gl = canvas.getContext('webgl', { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: true });
  if (!gl || gl.isContextLost()) throw new Error('Offscreen WebGL unavailable');
  const shaders = [];
  const compile = (type, source) => {
    const shader = gl.createShader(type);
    shaders.push(shader);
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Particle shader unavailable');
    return shader;
  };
  const program = gl.createProgram();
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Particle program unavailable');
  } catch (error) { gl.deleteProgram(program); throw error; }
  finally { for (const shader of shaders) gl.deleteShader(shader); }
  gl.useProgram(program);
  const viewportUniform = gl.getUniformLocation(program, 'u_viewport'), dprUniform = gl.getUniformLocation(program, 'u_dpr');
  const detailPassUniform = gl.getUniformLocation(program, 'u_detail_pass');
  const buffer = gl.createBuffer();
  let capacity = 0;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const [name, size, offset] of [['a_position', 2, 0], ['a_radius', 1, 2], ['a_colour', 4, 3], ['a_detail', 1, 7], ['a_seed', 1, 8]]) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 36, offset * 4);
  }
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  return {
    draw(data, count, width, height, dpr, detailPasses = 0) {
      if (gl.isContextLost()) return false;
      const w = Math.round(width * dpr), h = Math.round(height * dpr);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(viewportUniform, width, height);
      gl.uniform1f(dprUniform, dpr);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (count) {
        if (capacity !== data.byteLength) { gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW); capacity = data.byteLength; }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count));
        for (let pass = 0; pass <= detailPasses; pass++) {
          gl.uniform1f(detailPassUniform, pass);
          gl.drawArrays(gl.POINTS, 0, count / 9);
        }
      }
      gl.flush();
      return true;
    }
  };
}
