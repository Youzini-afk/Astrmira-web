function createDotAtlas() {
  // Cached antialiased stamps for the 2D path while the worker starts, or on
  // browsers without OffscreenCanvas. Colour error is at most 8.5 / 255.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const image = ctx.createImageData(512, 512);
  for (let colour = 0; colour < 4096; colour++) {
    const left = (colour % 64) * 8, top = Math.floor(colour / 64) * 8;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const i = ((top + y) * 512 + left + x) * 4;
      image.data[i] = (colour >> 8) * 17;
      image.data[i + 1] = ((colour >> 4) & 15) * 17;
      image.data[i + 2] = (colour & 15) * 17;
      image.data[i + 3] = Math.max(0, Math.min(1, 3.5 - Math.hypot(x - 3.5, y - 3.5))) * 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

export function createParticlePainter(ctx, canvas, onContextChange) {
  let worker, ready = false, presented = false, pending = false, recycled, atlas;
  let width = 1, height = 1, dpr = 1, count = 0;
  let displayed = '';
  let data = new Float32Array(7 * 256);
  const fallbackStyles = new Map();
  const status = () => {
    const mode = presented ? 'webgl-worker' : 'canvas';
    if (displayed === mode) return;
    if (canvas) canvas.style.visibility = presented ? 'visible' : 'hidden';
    document.documentElement.dataset.particleRenderer = mode;
    displayed = mode;
  };
  const unavailable = () => {
    ready = presented = false;
    status();
    onContextChange?.();
  };
  status();
  if (canvas?.transferControlToOffscreen && typeof Worker !== 'undefined') {
    try {
      worker = new Worker(new URL('./particle-worker.js', import.meta.url), { type: 'module' });
      const offscreen = canvas.transferControlToOffscreen();
      worker.onmessage = ({ data: message }) => {
        if (message.type === 'ready') {
          ready = true;
          onContextChange?.();
        } else if (message.type === 'unavailable') unavailable();
        else if (message.type === 'frame') {
          pending = false;
          recycled = new Float32Array(message.buffer);
          if (message.rendered && ready) {
            const first = !presented;
            presented = true;
            // A paused scene also needs one fresh paint to complete the handoff.
            if (first) onContextChange?.();
          }
        }
      };
      worker.onerror = event => { event.preventDefault(); worker.terminate(); unavailable(); };
      worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);
    } catch (_) { worker?.terminate(); worker = null; }
  }
  const fallback = () => {
    if (!ctx || !count) return;
    atlas ||= createDotAtlas();
    for (let i = 0; i < count; i += 7) {
      const x = data[i], y = data[i + 1], radius = data[i + 2];
      const r = Math.round(data[i + 3] * 15), g = Math.round(data[i + 4] * 15), b = Math.round(data[i + 5] * 15);
      const colour = (r << 8) | (g << 4) | b;
      ctx.globalAlpha = data[i + 6];
      if (radius > 0 && atlas) {
        const half = radius * 4 / 3;
        ctx.drawImage(atlas, (colour % 64) * 8, Math.floor(colour / 64) * 8, 8, 8, x - half, y - half, half * 2, half * 2);
      } else {
        if (!fallbackStyles.has(colour)) fallbackStyles.set(colour, `rgb(${r * 17},${g * 17},${b * 17})`);
        ctx.fillStyle = fallbackStyles.get(colour);
        const half = Math.abs(radius);
        ctx.fillRect(x - half, y - half, half * 2, half * 2);
      }
    }
    ctx.globalAlpha = 1;
  };
  return {
    get accelerated() { return presented; },
    resize(w, h, ratio) { width = w; height = h; dpr = ratio; },
    dot(x, y, radius, red, green, blue, opacity) {
      if (opacity <= .01) return;
      if (count + 7 > data.length) {
        const next = new Float32Array(data.length * 2);
        next.set(data); data = next;
      }
      data[count++] = x; data[count++] = y; data[count++] = radius;
      data[count++] = red / 255; data[count++] = green / 255; data[count++] = blue / 255;
      data[count++] = opacity;
    },
    flush() {
      status();
      if (!presented) fallback();
      if (ready && !pending) {
        const buffer = data.buffer, length = data.length;
        data = recycled?.length >= length ? recycled : new Float32Array(length);
        recycled = null;
        pending = true;
        worker.postMessage({ type: 'frame', buffer, count, width, height, dpr }, [buffer]);
      }
      count = 0;
    }
  };
}
