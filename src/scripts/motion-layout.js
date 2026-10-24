// DOM work is restricted to layout changes. Rasterize each text run once;
// transferable bitmaps are sampled and animated exclusively in the worker.
export async function captureGlyphs(hero) {
  if (!hero) return [];
  const $ = selector => hero.querySelector(selector);
  const $$ = selector => [...hero.querySelectorAll(selector)];
  const heroRect = hero.getBoundingClientRect();
  const captures = [];
    function sampleTextLine(text, style, targetX, targetCenterY, targetRgb, isTitle = false, fontStyleOverride = null, alignment = 'center') {
      if (!text || text.trim() === '') return;
      const offCanvas = document.createElement('canvas');
      const fontSize = parseFloat(style.fontSize) || 16;
      const fontFamily = style.fontFamily || 'Georgia, serif';
      const fontStyle = fontStyleOverride || style.fontStyle || 'normal';
      const fontWeight = style.fontWeight || '400';
      const letterSpacing = style.letterSpacing || 'normal';

      const ctx = offCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      try { ctx.letterSpacing = letterSpacing; } catch (_) {}

      const metrics = ctx.measureText(text);
      const textWidth = Math.ceil(metrics.width);
      const textHeight = Math.ceil(fontSize * 1.35);
      const pad = 16;
      const w = textWidth + pad * 2;
      const h = textHeight + pad * 2;
      // Sampling and final lettering retain the same native-resolution raster.
      const dpr = devicePixelRatio || 1;
      offCanvas.width = Math.ceil(w * dpr);
      offCanvas.height = Math.ceil(h * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      try { ctx.letterSpacing = letterSpacing; } catch (_) {}
      ctx.fillStyle = `rgb(${targetRgb.join(',')})`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(text, pad, h / 2);


      const left = targetX - textWidth * (alignment === 'right' ? 1 : alignment === 'left' ? 0 : .5) - pad;
      const top = targetCenterY - h / 2;
      captures.push(createImageBitmap(offCanvas).then(bitmap => ({ bitmap, left, top, dpr, fontSize, isTitle, rgb: targetRgb })));
    }

    function sampleElement(element, rgb, italic = null) {
      if (!element) return;
      const lines = [], walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const range = document.createRange();
        const text = node.textContent;
        // Words are cheap to measure; only a word wrapping across lines (for
        // example Chinese prose) needs character-level layout at initialization.
        for (const match of text.matchAll(/\S+\s*|\s+/gu)) {
          const add = (start, end) => {
            range.setStart(node, start); range.setEnd(node, end);
            const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
            if (rects.length > 1 && end - start > 1) {
              let index = start;
              for (const char of text.slice(start, end)) { add(index, index + char.length); index += char.length; }
              return;
            }
            const rect = rects[0];
            if (!rect) return;
            let line = lines.find(line => Math.abs(line.top - rect.top) < 1);
            if (!line) { line = { top: rect.top, height: rect.height, left: rect.left, text: '' }; lines.push(line); }
            line.text += text.slice(start, end);
          };
          add(match.index, match.index + match[0].length);
        }
      }
      const style = getComputedStyle(element);
      for (const line of lines) sampleTextLine(line.text.trim(), style, line.left - heroRect.left,
        line.top - heroRect.top + line.height / 2, rgb, false, italic, 'left');
    }
    // 1. Kicker
    const kickerEl = $('.hero-kicker');
    if (kickerEl) {
      const r = kickerEl.getBoundingClientRect();
      const style = window.getComputedStyle(kickerEl);
      const cx = r.left - heroRect.left + r.width / 2;
      const cy = r.top - heroRect.top + r.height / 2;
      sampleTextLine(kickerEl.textContent.trim(), style, cx, cy, [205, 192, 168], false);
    }

    // 2. Title: Astrmira (Astr + mira italic)
    const h1El = $('.hero h1');
    if (h1El) {
      const h1Style = window.getComputedStyle(h1El);
      const fontSize = parseFloat(h1Style.fontSize) || 130;
      const fontFamily = h1Style.fontFamily || 'Georgia, serif';

      const mCanvas = document.createElement('canvas');
      const mCtx = mCanvas.getContext('2d');
      mCtx.font = `normal 400 ${fontSize}px ${fontFamily}`;
      try { mCtx.letterSpacing = '-0.075em'; } catch (_) {}
      const wAstr = mCtx.measureText('Astr').width;

      mCtx.font = `italic 400 ${fontSize}px ${fontFamily}`;
      try { mCtx.letterSpacing = '-0.08em'; } catch (_) {}
      const wMira = mCtx.measureText('mira').width;

      const overlap = fontSize * 0.045;
      const totalH1Width = wAstr + wMira - overlap;
      const rH1 = h1El.getBoundingClientRect();
      const h1CenterX = (rH1.left - heroRect.left) + rH1.width / 2;
      const h1CenterY = (rH1.top - heroRect.top) + rH1.height / 2;

      const cxAstr = h1CenterX - totalH1Width / 2 + wAstr / 2;
      const cxMira = h1CenterX - totalH1Width / 2 + wAstr - overlap + wMira / 2;

      sampleTextLine('Astr', h1Style, cxAstr, h1CenterY, [238, 234, 225], true, 'normal');
      sampleTextLine('mira', h1Style, cxMira, h1CenterY, [238, 234, 225], true, 'italic');
    }

    // 3. Subtitle
    const subEl = $('.hero-subtitle');
    sampleElement(subEl, [250, 248, 243]);

    // 4. Supporting line
    const engEl = $('.hero-english');
    sampleElement(engEl, [172, 179, 193], 'italic');

    // 5. Description
    const descEl = $('.hero-description');
    sampleElement(descEl, [165, 174, 189]);

    // The Mira annotation joins the same star gathering and cached glyphs.
    // Measure each line separately to preserve its right edge and typography.
    for (const line of $$('[data-coordinate-line]', hero)) {
      const rect = line.getBoundingClientRect();
      const style = window.getComputedStyle(line);
      const rgb = style.color.match(/[\d.]+/g)?.slice(0, 3).map(Number) || [155, 165, 182];
      sampleTextLine(line.textContent.trim(), style, rect.right - heroRect.left,
        rect.top - heroRect.top + rect.height / 2, rgb, false, null, 'right');
    }

  return Promise.all(captures);
}

export function glyphSurfaceBounds(glyphs, dpr) {
  if (!glyphs.length) return { left: 0, top: 0, width: 0, height: 0 };
  const left = Math.floor(Math.min(...glyphs.map(g => g.left)) * dpr);
  const top = Math.floor(Math.min(...glyphs.map(g => g.top)) * dpr);
  const right = Math.ceil(Math.max(...glyphs.map(g => g.left + g.bitmap.width / g.dpr)) * dpr);
  const bottom = Math.ceil(Math.max(...glyphs.map(g => g.top + g.bitmap.height / g.dpr)) * dpr);
  return { left: left / dpr, top: top / dpr, width: (right - left) / dpr, height: (bottom - top) / dpr };
}
