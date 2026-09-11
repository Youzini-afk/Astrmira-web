import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const hook = `
self.__motionEvidence = { draws: 0, glyphDraws: 0, callbacks: [], maskBytes: 0 };
const originalContext = OffscreenCanvas.prototype.getContext;
OffscreenCanvas.prototype.getContext = function(type, options) {
  const gl = originalContext.call(this, type, options);
  if (gl && type.startsWith('webgl')) {
    const lettering = Boolean(options?.preserveDrawingBuffer);
    if (lettering) {
      self.__testGlyphGL = gl;
      self.__glyphSources = new Map();
      const sources = new Map(), bindings = new Map();
      let unit = gl.TEXTURE0, rect;
      const active = gl.activeTexture.bind(gl), bind = gl.bindTexture.bind(gl), upload = gl.texImage2D.bind(gl);
      const uniform = gl.uniform4f.bind(gl), draw = gl.drawArrays.bind(gl), remove = gl.deleteTexture.bind(gl);
      gl.activeTexture = value => { unit = value; return active(value); };
      gl.bindTexture = (type, texture) => { bindings.set(unit, texture); return bind(type, texture); };
      gl.texImage2D = (...args) => { if (args.length === 6 && args[5]?.getContext) sources.set(bindings.get(unit), args[5]); return upload(...args); };
      gl.uniform4f = (location, ...value) => { rect = value; return uniform(location, ...value); };
      gl.drawArrays = (...args) => {
        const texture = bindings.get(gl.TEXTURE0), source = sources.get(texture);
        if (source && rect) self.__glyphSources.set(texture, { source, rect: [...rect] });
        return draw(...args);
      };
      gl.deleteTexture = texture => { sources.delete(texture); self.__glyphSources.delete(texture); return remove(texture); };
    } else self.__testGL = gl;
    const flush = gl.flush.bind(gl), upload = gl.texSubImage2D.bind(gl);
    gl.flush = () => {
      self.__motionEvidence[lettering ? 'glyphDraws' : 'draws']++;
      const result = flush();
      if (!lettering && self.__capture) {
        const { rect, resolve } = self.__capture; self.__capture = null;
        const ratio = gl.drawingBufferWidth / rect.viewportWidth;
        const x = Math.max(0, Math.floor(rect.x * ratio)), y = Math.max(0, Math.floor(gl.drawingBufferHeight - (rect.y + rect.height) * ratio));
        const w = Math.min(gl.drawingBufferWidth - x, Math.ceil(rect.width * ratio)), h = Math.min(gl.drawingBufferHeight - y, Math.ceil(rect.height * ratio));
        const pixels = new Uint8Array(w * h * 4);
        gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let ink = 0;
        for (let i = 0; i < pixels.length; i += 4) ink += pixels[i] + pixels[i + 1] + pixels[i + 2];
        resolve(ink);
      }
      return result;
    };
    gl.texSubImage2D = (...args) => { self.__motionEvidence.maskBytes += args.at(-1)?.byteLength || 0; return upload(...args); };
  }
  return gl;
};
const originalRAF = self.requestAnimationFrame.bind(self);
self.requestAnimationFrame = callback => originalRAF(time => {
  const started = performance.now();
  try { callback(time); }
  finally { self.__motionEvidence.callbacks.push({ time, cost: performance.now() - started }); }
});
`;

// Test-only hooks are applied to the HTTP response, never to production files.
export async function serveMotionBuild(directory = 'dist') {
  const root = path.resolve(directory);
  const server = http.createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = path.resolve(root, '.' + decodeURIComponent(pathname) + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    try {
      let body = await readFile(file);
      if (path.basename(file).startsWith('particle-worker') && file.endsWith('.js')) body = hook + body;
      response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream');
      response.end(body);
    } catch (_) { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}/`, close: () => new Promise(resolve => server.close(resolve)) };
}

export function installMainProbe() {
  window.__motionEvidence = { callbacks: [], tasks: [], readbacks: 0, particleTransfers: 0, scrollCalls: 0, glyphBounds: [] };
  const scroll = window.scrollTo;
  window.scrollTo = (...args) => { window.__motionEvidence.scrollCalls++; return scroll(...args); };
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = callback => raf(time => {
    const started = performance.now();
    try { callback(time); } finally { window.__motionEvidence.callbacks.push({ time, cost: performance.now() - started }); }
  });
  const read = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function(...args) { window.__motionEvidence.readbacks++; return read.apply(this, args); };
  const post = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function(data, ...args) {
    if (data?.buffer instanceof ArrayBuffer) window.__motionEvidence.particleTransfers += data.buffer.byteLength;
    if (data?.layout?.glyphs) window.__motionEvidence.glyphBounds = data.layout.glyphs.map(g => ({ left: g.left + (data.layout.hero?.left || 0), width: g.bitmap.width / g.dpr }));
    return post.call(this, data, ...args);
  };
  new PerformanceObserver(list => window.__motionEvidence.tasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })))).observe({ type: 'longtask', buffered: true });
}
