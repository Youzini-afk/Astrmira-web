import { createGpuPointRenderer } from './gpu-points.js';

let renderer = null;
self.onmessage = ({ data }) => {
  if (data.type === 'init') {
    const canvas = data.canvas;
    const setup = () => {
      try { renderer = createGpuPointRenderer(canvas); self.postMessage({ type: 'ready' }); }
      catch (_) { renderer = null; self.postMessage({ type: 'unavailable' }); }
    };
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); renderer = null;
      self.postMessage({ type: 'unavailable' });
    });
    canvas.addEventListener('webglcontextrestored', setup);
    setup();
  } else if (data.type === 'frame') {
    let rendered = false;
    try {
      if (renderer) rendered = renderer.draw(new Float32Array(data.buffer), data.count, data.width, data.height, data.dpr, data.detailPasses);
    } catch (_) { renderer = null; self.postMessage({ type: 'unavailable' }); }
    finally {
      // Return the same storage for reuse. There is no growing queue of stale
      // frames: the page sends its current snapshot when the renderer is free.
      self.postMessage({ type: 'frame', buffer: data.buffer, rendered }, [data.buffer]);
    }
  }
};
