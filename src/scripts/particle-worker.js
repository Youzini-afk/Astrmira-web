import { createSceneRenderer } from './scene-renderer.js';
import { createGlyphRenderer } from './glyph-renderer.js';
import { createMotionScene } from './motion-scene.js';

// A self-contained scene with its own display clock. The document sends only
// layout snapshots and the latest input, never per-frame particle arrays.
let renderer = null, glyphRenderer = null, scene = null, canvas, glyphCanvas, state, layout, revision = 0, raf = 0, presented = false, failed = false;
let ratio = 1, nativeRatio = 1, windowStart = 0, frames = 0, blocked = 0, healthySince = 0;
const lostContexts = new Set();

function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
function unavailable() { failed = true; stop(); self.postMessage({ type: 'unavailable' }); }
function schedule() {
  if (!raf && renderer && scene && !failed && !state.hidden) raf = requestAnimationFrame(draw);
}
function draw(now) {
  raf = 0;
  if (!renderer || !scene || failed || state.hidden) return;
  frames++;
  let rendered = false;
  if (!renderer.available()) blocked++;
  else {
    scene.draw(now, state, ratio);
    rendered = !glyphRenderer?.pending;
    if (rendered && !presented) { presented = true; self.postMessage({ type: 'presented', revision }); }
  }
  // GPU completion, not gl.flush submission, controls raster density. Keep
  // every star and filament; only the sky's backing resolution changes under
  // sustained pressure. Lettering keeps native pixels on its retained surface.
  if (!windowStart) windowStart = now;
  if (now - windowStart >= 1200) {
    const pressure = blocked / Math.max(1, frames);
    if (pressure > .25) { ratio = Math.max(Math.min(1, nativeRatio), ratio * .85); healthySince = 0; }
    else if (pressure < .03) {
      healthySince ||= now;
      if (now - healthySince > 6000) { ratio = Math.min(nativeRatio, ratio / .85); healthySince = now; }
    } else healthySince = 0;
    windowStart = now; frames = blocked = 0;
  }
  if (!state.paused || !rendered) schedule();
}

self.onmessage = ({ data }) => {
  try {
    if (data.type === 'init') {
      canvas = data.canvas; glyphCanvas = data.glyphCanvas;
      renderer = createSceneRenderer(canvas);
      for (const surface of [canvas, glyphCanvas]) {
        surface.addEventListener('webglcontextlost', event => {
          event.preventDefault(); lostContexts.add(surface); unavailable();
        });
        surface.addEventListener('webglcontextrestored', () => {
          lostContexts.delete(surface);
          if (lostContexts.size) return;
          try {
            scene?.destroy(); scene = null;
            glyphRenderer?.destroy(); glyphRenderer = null;
            renderer?.destroy(); renderer = createSceneRenderer(canvas); failed = false;
            self.postMessage({ type: 'restored' });
          } catch (error) { unavailable(); console.error('Motion restoration unavailable:', error); }
        });
      }
    } else if (data.type === 'layout') {
      stop();
      scene?.destroy();
      revision = data.revision; state = data.state; layout = data.layout;
      nativeRatio = ratio = Math.min(layout.dpr, 1.5);
      presented = false; windowStart = frames = blocked = healthySince = 0;
      if (!renderer) { layout.glyphs.forEach(g => g.bitmap.close()); unavailable(); return; }
      if (layout.glyphs.length && !glyphRenderer) glyphRenderer = createGlyphRenderer(glyphCanvas);
      glyphRenderer?.resize(layout.glyphBounds, layout.dpr);
      scene = createMotionScene(layout, renderer, glyphRenderer, state); failed = false;
      self.postMessage({ type: 'prepared', revision });
      // Wait for the document to choose replay vs settled before first paint.
    } else if (data.type === 'input') {
      if (data.state.revision === revision) {
        state = { ...state, ...data.state };
        if (state.hidden) stop(); else schedule();
      }
      self.postMessage({ type: 'input-ready' });
    }
  } catch (error) {
    unavailable();
    // Errors stay visible to developer tools without blocking the native page.
    console.error('Motion scene unavailable:', error);
  }
};
