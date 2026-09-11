// One WebGL surface owns stars, letters and the wake. No display-sized CPU
// image upload occurs during animation; only small alpha masks change.
const POINT_VERTEX = `#version 300 es

in vec2 a_position;
in float a_radius;
in vec4 a_colour;
in float a_detail;
in float a_seed;
uniform vec2 u_viewport;
uniform float u_dpr;
uniform float u_detail_pass;
out vec4 v_colour;
out float v_radius;
out float v_size;
out float v_square;
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
}
`;
const POINT_FRAGMENT = `#version 300 es
precision mediump float;
out vec4 colour;


in vec4 v_colour;
in float v_radius;
in float v_size;
in float v_square;
void main() {
  if (v_colour.a <= 0.001) discard;
  vec2 p = abs(gl_PointCoord - vec2(0.5)) * v_size;
  float distance = mix(length(p), max(p.x, p.y), v_square);
  float alpha = clamp(v_radius + 0.5 - distance, 0.0, 1.0) * v_colour.a;
  colour = vec4(v_colour.rgb, alpha);
}
`;
const GLYPH_VERTEX = `#version 300 es
in vec2 a_corner;
uniform vec2 u_viewport;
uniform vec4 u_rect;
out vec2 v_uv;
void main() {
  v_uv = a_corner;
  gl_Position = vec4((u_rect.xy + a_corner * u_rect.zw) / u_viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
}
`;
const GLYPH_FRAGMENT = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_glyph;
uniform sampler2D u_mask;
uniform vec2 u_mask_scale;
uniform vec2 u_mask_offset;
uniform float u_opacity;
out vec4 colour;
void main() {
  vec4 glyph = texture(u_glyph, v_uv);
  float coverage = texture(u_mask, v_uv * u_mask_scale + u_mask_offset).a;
  colour = vec4(glyph.rgb, glyph.a * coverage * u_opacity);
}
`;
const LINE_VERTEX = `#version 300 es
in vec2 a_position;
in vec2 a_normal;
in vec3 a_shape; // distance, side, spread
in vec4 a_colour;
in vec2 a_pen; // width, offset
uniform vec2 u_viewport;
uniform vec2 u_scroll;
uniform float u_dpr;
out vec4 v_colour;
out float v_distance;
out float v_edge;
out float v_width;
void main() {
  float halfWidth = a_pen.x * .5;
  vec2 position = a_position + a_normal * (a_pen.y * a_shape.z + a_shape.y * (halfWidth + 1. / u_dpr));
  gl_Position = vec4((position - u_scroll) / u_viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
  v_colour = a_colour; v_distance = a_shape.x;
  v_edge = a_shape.y * (halfWidth * u_dpr + 1.);
  v_width = halfWidth * u_dpr;
}
`;
const LINE_FRAGMENT = `#version 300 es
precision highp float;
in vec4 v_colour;
in float v_distance;
in float v_edge;
in float v_width;
uniform vec3 u_range; // rear, front, feather
uniform float u_opacity;
out vec4 colour;
void main() {
  if (v_distance < u_range.x || v_distance > u_range.y) discard;
  float feather = smoothstep(0., max(.00001, u_range.z), v_distance - u_range.x);
  float edge = clamp(v_width + .5 - abs(v_edge), 0., 1.);
  colour = vec4(v_colour.rgb, v_colour.a * edge * feather * u_opacity);
}
`;

export function createSceneRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const programs = [], buffers = [], vaos = [];
  const program = (vertex, fragment) => {
    const p = gl.createProgram(), shaders = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
        const s = gl.createShader(type); shaders.push(s);
        gl.shaderSource(s, source); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        gl.attachShader(p, s);
      }
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    } catch (e) { gl.deleteProgram(p); throw e; }
    finally { shaders.forEach(s => gl.deleteShader(s)); }
    const uniforms = new Map();
    programs.push(p);
    return { p, u(name) { if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(p, 'u_' + name)); return uniforms.get(name); } };
  };
  const buffer = () => { const b = gl.createBuffer(); buffers.push(b); return b; };
  const vao = () => { const v = gl.createVertexArray(); vaos.push(v); gl.bindVertexArray(v); return v; };
  const attribute = (p, name, size, stride, offset, divisor = 0) => {
    const at = gl.getAttribLocation(p.p, 'a_' + name);
    if (at < 0) return;
    gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, size, gl.FLOAT, false, stride * 4, offset * 4);
    gl.vertexAttribDivisor(at, divisor);
  };
  const points = program(POINT_VERTEX, POINT_FRAGMENT), glyph = program(GLYPH_VERTEX, GLYPH_FRAGMENT), line = program(LINE_VERTEX, LINE_FRAGMENT);
  const pointVao = vao(), pointBuffer = buffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
  for (const [name, size, offset] of [['position', 2, 0], ['radius', 1, 2], ['colour', 4, 3], ['detail', 1, 7], ['seed', 1, 8]]) attribute(points, name, size, 9, offset);
  const glyphVao = vao();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 1,1]), gl.STATIC_DRAW);
  attribute(glyph, 'corner', 2, 2, 0);
  const openingVao = vao(), openingBuffer = buffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, openingBuffer);
  attribute(line, 'position', 2, 13, 0); attribute(line, 'normal', 2, 13, 2);
  attribute(line, 'shape', 3, 13, 4); attribute(line, 'colour', 4, 13, 7); attribute(line, 'pen', 2, 13, 11);
  const wakeVao = vao(), wakeBuffer = buffer(), strandBuffer = buffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, wakeBuffer);
  attribute(line, 'position', 2, 7, 0); attribute(line, 'normal', 2, 7, 2); attribute(line, 'shape', 3, 7, 4);
  gl.bindBuffer(gl.ARRAY_BUFFER, strandBuffer);
  attribute(line, 'colour', 4, 6, 0, 1); attribute(line, 'pen', 2, 6, 4, 1);
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  let width = 1, height = 1, dpr = 1, count = 0, detail = 0, pointCapacity = 0, wakeCapacity = 0;
  let data = new Float32Array(9 * 1024), openingCount = 0, strandCount = 0, fence = null;
  const texture = (w, h, source) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return t;
  };
  const lineState = (scrollX, scrollY, rear, front, feather, opacity) => {
    gl.useProgram(line.p);
    gl.uniform2f(line.u('viewport'), width, height); gl.uniform2f(line.u('scroll'), scrollX, scrollY);
    gl.uniform1f(line.u('dpr'), dpr); gl.uniform3f(line.u('range'), rear, front, feather);
    gl.uniform1f(line.u('opacity'), opacity);
  };
  return {
    available() {
      if (gl.isContextLost()) return false;
      if (!fence) return true;
      // Timeout zero: observe completion without ever waiting on the driver.
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED) return false;
      gl.deleteSync(fence); fence = null;
      return true;
    },
    begin(w, h, ratio) {
      width = w; height = h; dpr = ratio;
      const pw = Math.round(w * ratio), ph = Math.round(h * ratio);
      if (canvas.width !== pw) canvas.width = pw;
      if (canvas.height !== ph) canvas.height = ph;
      gl.viewport(0, 0, pw, ph); gl.clear(gl.COLOR_BUFFER_BIT);
      count = detail = 0;
    },
    createGlyph(layer) {
      layer.texture = texture(0, 0, layer.glyph);
      layer.maskTexture = texture(layer.columns, layer.rows, null);
      layer.needsPaint = true;
    },
    deleteGlyph(layer) {
      gl.deleteTexture(layer.texture); gl.deleteTexture(layer.maskTexture);
    },
    updateMask(layer) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, layer.maskTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, layer.columns, layer.rows, gl.RGBA, gl.UNSIGNED_BYTE, layer.alphaData);
    },
    glyphs(layers, left, top, opacity) {
      gl.useProgram(glyph.p); gl.bindVertexArray(glyphVao);
      gl.uniform2f(glyph.u('viewport'), width, height);
      gl.uniform1f(glyph.u('opacity'), opacity);
      gl.uniform1i(glyph.u('glyph'), 0); gl.uniform1i(glyph.u('mask'), 1);
      for (const layer of layers) {
        const w = layer.glyph.width / layer.dpr, h = layer.glyph.height / layer.dpr;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, layer.texture);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, layer.maskTexture);
        gl.uniform4f(glyph.u('rect'), left + layer.left, top + layer.top, w, h);
        gl.uniform2f(glyph.u('mask_scale'), w / (layer.columns * layer.cellSize), h / (layer.rows * layer.cellSize));
        gl.uniform2f(glyph.u('mask_offset'), .5 / layer.columns, .5 / layer.rows);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
    },
    setTail(opening, strands) {
      gl.bindBuffer(gl.ARRAY_BUFFER, openingBuffer); gl.bufferData(gl.ARRAY_BUFFER, opening, gl.STATIC_DRAW);
      openingCount = opening.length / 13;
      gl.bindBuffer(gl.ARRAY_BUFFER, strandBuffer); gl.bufferData(gl.ARRAY_BUFFER, strands, gl.STATIC_DRAW);
      strandCount = strands.length / 6;
    },
    opening(scrollX, scrollY, rear, front, feather, opacity) {
      if (!openingCount || front <= rear) return;
      lineState(scrollX, scrollY, rear, front, feather, opacity);
      gl.bindVertexArray(openingVao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, openingCount);
    },
    wake(nodes, scrollX, scrollY, rear, front, feather, opacity) {
      if (nodes.length < 14) return;
      lineState(scrollX, scrollY, rear, front, feather, opacity);
      gl.bindVertexArray(wakeVao); gl.bindBuffer(gl.ARRAY_BUFFER, wakeBuffer);
      if (wakeCapacity < nodes.byteLength) { wakeCapacity = nodes.byteLength * 2; gl.bufferData(gl.ARRAY_BUFFER, wakeCapacity, gl.DYNAMIC_DRAW); }
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, nodes);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, nodes.length / 7, strandCount);
    },
    dot(x, y, radius, r, g, b, alpha, grain = 0, seed = 0) {
      if (alpha <= .01) return;
      if (count + 9 > data.length) { const next = new Float32Array(data.length * 2); next.set(data); data = next; }
      data[count++] = x; data[count++] = y; data[count++] = radius;
      data[count++] = r / 255; data[count++] = g / 255; data[count++] = b / 255; data[count++] = alpha;
      data[count++] = grain; data[count++] = seed;
      detail = Math.max(detail, grain > .82 ? 3 : grain > .45 ? 2 : grain > 0 ? 1 : 0);
    },
    flush() {
      gl.useProgram(points.p); gl.bindVertexArray(pointVao);
      gl.uniform2f(points.u('viewport'), width, height); gl.uniform1f(points.u('dpr'), dpr);
      if (count) {
        gl.bindBuffer(gl.ARRAY_BUFFER, pointBuffer);
        if (pointCapacity < data.byteLength) { pointCapacity = data.byteLength; gl.bufferData(gl.ARRAY_BUFFER, pointCapacity, gl.DYNAMIC_DRAW); }
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, count));
        for (let pass = 0; pass <= detail; pass++) {
          gl.uniform1f(points.u('detail_pass'), pass); gl.drawArrays(gl.POINTS, 0, count / 9);
        }
      }
      if (fence) gl.deleteSync(fence);
      fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
    },
    destroy() {
      if (fence) gl.deleteSync(fence);
      programs.forEach(p => gl.deleteProgram(p)); buffers.forEach(b => gl.deleteBuffer(b)); vaos.forEach(v => gl.deleteVertexArray(v));
    }
  };
}
