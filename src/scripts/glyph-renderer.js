// Text retains native display pixels independently of the animated sky's
// resolution. Only changed glyph regions are repainted; settled text is idle.
const VERTEX = `#version 300 es
in vec2 a_corner;
uniform vec2 u_viewport;
uniform vec4 u_rect;
out vec2 v_uv;
void main() {
  v_uv = a_corner;
  gl_Position = vec4((u_rect.xy + a_corner * u_rect.zw) / u_viewport * vec2(2., -2.) + vec2(-1., 1.), 0., 1.);
}`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_glyph;
uniform sampler2D u_mask;
uniform vec2 u_mask_scale;
uniform vec2 u_mask_offset;
out vec4 colour;
void main() {
  vec4 glyph = texture(u_glyph, v_uv);
  float coverage = texture(u_mask, v_uv * u_mask_scale + u_mask_offset).a;
  colour = vec4(glyph.rgb, glyph.a * coverage);
}`;

export function createGlyphRenderer(canvas) {
  // Retention allows scissored updates to preserve every untouched letter.
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  if (!gl) throw new Error('Native-resolution glyph surface unavailable');
  const program = gl.createProgram(), shaders = [];
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]]) {
      const shader = gl.createShader(type); shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  } catch (error) { gl.deleteProgram(program); throw error; }
  finally { shaders.forEach(shader => gl.deleteShader(shader)); }
  const u = Object.fromEntries(['viewport', 'rect', 'glyph', 'mask', 'mask_scale', 'mask_offset'].map(name => [name, gl.getUniformLocation(program, 'u_' + name)]));
  const vao = gl.createVertexArray(), buffer = gl.createBuffer();
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0,0, 1,0, 0,1, 1,1]), gl.STATIC_DRAW);
  const corner = gl.getAttribLocation(program, 'a_corner');
  gl.enableVertexAttribArray(corner); gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);
  let bounds, ratio = 1, fence = null, repaintAll = true;
  const dirty = new Set();
  const texture = (width, height, source) => {
    const value = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, value);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return value;
  };
  const rect = layer => ({
    x: Math.round((layer.left - bounds.left) * ratio), y: Math.round((layer.top - bounds.top) * ratio),
    width: layer.glyph.width, height: layer.glyph.height
  });
  return {
    get pending() { return repaintAll || dirty.size > 0; },
    resize(next, dpr) {
      bounds = next; ratio = dpr;
      canvas.width = Math.max(1, Math.round(next.width * ratio));
      canvas.height = Math.max(1, Math.round(next.height * ratio));
      repaintAll = true; dirty.clear();
    },
    createGlyph(layer) {
      layer.texture = texture(0, 0, layer.glyph);
      layer.maskTexture = texture(layer.columns, layer.rows, null);
      layer.needsPaint = true; dirty.add(layer);
    },
    deleteGlyph(layer) {
      gl.deleteTexture(layer.texture); gl.deleteTexture(layer.maskTexture); dirty.delete(layer);
    },
    updateMask(layer) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, layer.maskTexture);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, layer.columns, layer.rows, gl.RGBA, gl.UNSIGNED_BYTE, layer.alphaData);
      dirty.add(layer);
    },
    paint(layers) {
      if (!repaintAll && !dirty.size) return;
      if (gl.isContextLost()) return;
      if (fence) {
        if (gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) return;
        gl.deleteSync(fence); fence = null;
      }
      const changed = [...dirty].map(rect);
      const left = repaintAll ? 0 : Math.max(0, Math.min(...changed.map(r => r.x)));
      const top = repaintAll ? 0 : Math.max(0, Math.min(...changed.map(r => r.y)));
      const right = repaintAll ? canvas.width : Math.min(canvas.width, Math.max(...changed.map(r => r.x + r.width)));
      const bottom = repaintAll ? canvas.height : Math.min(canvas.height, Math.max(...changed.map(r => r.y + r.height)));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(left, canvas.height - bottom, Math.max(0, right - left), Math.max(0, bottom - top));
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program); gl.bindVertexArray(vao);
      gl.uniform2f(u.viewport, canvas.width, canvas.height);
      gl.uniform1i(u.glyph, 0); gl.uniform1i(u.mask, 1);
      // Include overlaps in the dirty rectangle, so a changed run cannot erase
      // an untouched neighbour. Device-pixel coordinates avoid a second blur.
      for (const layer of layers) {
        const r = rect(layer);
        if (r.x >= right || r.y >= bottom || r.x + r.width <= left || r.y + r.height <= top) continue;
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, layer.texture);
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, layer.maskTexture);
        gl.uniform4f(u.rect, r.x, r.y, r.width, r.height);
        gl.uniform2f(u.mask_scale, r.width / (layer.dpr * layer.columns * layer.cellSize), r.height / (layer.dpr * layer.rows * layer.cellSize));
        gl.uniform2f(u.mask_offset, .5 / layer.columns, .5 / layer.rows);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      gl.disable(gl.SCISSOR_TEST);
      dirty.clear(); repaintAll = false;
      fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush();
    },
    destroy() {
      if (fence) gl.deleteSync(fence);
      dirty.clear(); gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program);
    }
  };
}
