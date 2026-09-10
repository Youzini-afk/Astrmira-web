/* Astrmira — progressive enhancement. No network requests, no external runtime. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');
  const standalone = document.body.dataset.mode === 'standalone';
  const main = $('#main');
  let filterResearch = 'all';
  let queryY = 154;
  let agentStage = 0;
  let brief = '';
  let copiedTimer;
  let paused = reduced.matches;
  try { paused = reduced.matches || sessionStorage.getItem('astrmira-motion') === 'paused'; } catch (_) { /* Sandboxed browsers may disable storage. */ }

  function initPage({ focus = false } = {}) {
    filterResearch = 'all'; queryY = 154; agentStage = 0; brief = '';
    const route = main?.dataset.route || 'home';
    $$('.site-nav [data-route]').forEach(a => {
      if (route === a.dataset.route || route.startsWith(a.dataset.route + '/')) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    $('[data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
    $('.site-nav')?.classList.remove('is-open');
    drawQuant(3); drawAgent(); updateMotionButtons();
    if (focus) main?.focus({ preventScroll: true });
    updateStarTarget();
  }

  function go(route, push = true) {
    if (!standalone) return;
    const template = document.getElementById('page-' + route.replaceAll('/', '--'));
    if (!template || !main) return;
    main.replaceChildren(template.content.cloneNode(true));
    main.dataset.route = route;
    const titles = $('#route-titles');
    if (titles) {
      try { document.title = JSON.parse(titles.textContent)[route] || 'Astrmira'; } catch (_) {}
    }
    if (push) history.pushState({ route }, '', '#/' + (route === 'home' ? '' : route));
    window.scrollTo({ top: 0, behavior: 'instant' });
    initPage({ focus: true });
  }
  window.addEventListener('popstate', () => {
    if (!standalone) return;
    const route = location.hash.startsWith('#/') ? location.hash.slice(2) || 'home' : 'home';
    go(route, false);
  });

  function activateTab(key, focus = false) {
    const target = $('[data-lab-tab="' + key + '"]');
    if (!target) return;
    $$('[data-lab-tab]').forEach(tab => {
      const active = tab === target;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.hidden = !active;
    });
    if (focus) target.focus();
    if (key === 'quant') drawQuant(Number($('[data-bits-range]')?.value || 3));
    if (key === 'agent') drawAgent();
  }

  function moveQuery(x, y = queryY, announce = true) {
    const svg = $('[data-lab-svg="vector"]');
    if (!svg) return;
    x = clamp(x, 50, 500); y = clamp(y, 30, 275); queryY = y;
    const points = $$('[data-point]', svg).map(el => ({
      el, x: Number(el.getAttribute('cx')), y: Number(el.getAttribute('cy'))
    }));
    const nearest = points.map((p, i) => ({ i, d: (p.x - x) ** 2 + (p.y - y) ** 2 }))
      .sort((a, b) => a.d - b.d).slice(0, 5).map(p => p.i);
    points.forEach((p, i) => {
      p.el.setAttribute('fill', nearest.includes(i) ? '#d6b881' : '#7792af');
      p.el.setAttribute('r', nearest.includes(i) ? '3' : '2');
      p.el.setAttribute('opacity', nearest.includes(i) ? '1' : '.6');
    });
    $('[data-neighbor-lines]', svg).innerHTML = nearest.map(i =>
      `<path d="M${x.toFixed(2)} ${y.toFixed(2)}L${points[i].x} ${points[i].y}" stroke="#d6b881" stroke-opacity=".6" stroke-width=".8"/>`).join('');
    $('[data-query]', svg).setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    const range = $('[data-query-range]'); if (range) range.value = String(Math.round(x));
    const feedback = $('[data-query-feedback]');
    if (announce && feedback) feedback.textContent = `查询点已更新 · 重新选出了距离最近的 5 个数据点。`;
  }

  function drawQuant(bits) {
    const svg = $('[data-lab-svg="quant"]'); if (!svg) return;
    bits = clamp(Math.round(bits), 1, 6); const levels = 2 ** bits;
    let original = '', quantized = '';
    for (let i = 0; i <= 180; i++) {
      const x = 42 + (i / 180) * 472;
      const value = clamp(.5 + .28 * Math.sin(i / 22) + .105 * Math.sin(i / 9.8), 0, 1);
      const q = Math.round(value * (levels - 1)) / (levels - 1);
      original += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(247 - value * 194).toFixed(1)} `;
      quantized += `${i ? 'L' : 'M'}${x.toFixed(1)} ${(247 - q * 194).toFixed(1)} `;
    }
    let grid = '';
    for (let i = 0; i < Math.min(levels, 32); i++) {
      const y = 247 - i / (Math.min(levels, 32) - 1) * 194;
      grid += `<path d="M42 ${y.toFixed(1)}H516" stroke="#a1b7cf" stroke-opacity=".1" stroke-width=".5"/>`;
    }
    svg.innerHTML = `${grid}<path d="M42 35V263H522" stroke="#a1b7cf" stroke-opacity=".25" stroke-width=".7"/><path d="${original}" fill="none" stroke="#90acc9" stroke-opacity=".6" stroke-width="1.2"/><path d="${quantized}" fill="none" stroke="#d6b881" stroke-width="1.4"/><text x="44" y="24" fill="#8797ac" font-size="9" font-family="monospace">VALUE</text><text x="470" y="285" fill="#8797ac" font-size="9" font-family="monospace">SAMPLE</text><text x="399" y="30" fill="#d6b881" font-size="11" font-family="monospace">${levels} LEVELS / ${bits} BIT</text>`;
    const output = $('[data-bits-output]'); if (output) output.textContent = bits + ' bit';
    const feedback = $('[data-quant-feedback]'); if (feedback) feedback.textContent = `${levels} 个表示等级 · 仅为标量量化示意`;
  }

  const stages = ['理解任务', '制定计划', '调用工具', '检查结果', '交付结果'];
  function drawAgent() {
    const svg = $('[data-lab-svg="agent"]'); if (!svg) return;
    const nodes = [[77,150],[196,86],[346,86],[459,150],[290,223]];
    let graph = '<defs><marker id="agent-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L7 4 1 7" fill="none" stroke="#7188a1"/></marker></defs>';
    const paths = ['M100 137L170 99','M228 86H315','M371 101L436 137','M434 166L320 209'];
    graph += paths.map((d,i)=>`<path d="${d}" fill="none" stroke="${i < agentStage ? '#d6b881' : '#7188a1'}" stroke-opacity=".55" stroke-width=".9" marker-end="url(#agent-arrow)"/>`).join('');
    graph += '<path d="M453 177C485 286 104 310 178 119" fill="none" stroke="#829ab3" stroke-opacity=".23" stroke-width=".7" stroke-dasharray="3 6" marker-end="url(#agent-arrow)"/><text x="125" y="279" fill="#788aa0" font-size="9" font-family="sans-serif">检查未通过时，修订计划</text>';
    nodes.forEach(([x,y],i)=>{
      const active = i === agentStage;
      graph += `<g><circle cx="${x}" cy="${y}" r="${active ? 33 : 27}" fill="${active ? '#25251f' : '#111923'}" stroke="${active ? '#d6b881' : '#7188a1'}" stroke-opacity="${active ? '.9' : '.5'}" stroke-width=".8"/><text x="${x}" y="${y+4}" text-anchor="middle" fill="${active ? '#ead5ac' : '#a8b6c7'}" font-family="monospace" font-size="11">0${i+1}</text><text x="${x}" y="${y+(i<3 ? -43 : 48)}" text-anchor="middle" fill="${active ? '#d6b881' : '#8d9cb0'}" font-size="11" font-family="sans-serif">${stages[i]}</text></g>`;
    });
    graph += '<rect x="291" y="19" width="110" height="23" rx="0" fill="#d6b881" fill-opacity=".03" stroke="#d6b881" stroke-opacity=".2"/><text x="346" y="34" text-anchor="middle" fill="#b8a687" font-size="9" font-family="sans-serif">关键操作 · 人类确认</text><path d="M346 42V53" stroke="#d6b881" stroke-opacity=".4" stroke-dasharray="2 3"/>';
    svg.innerHTML = graph;
    const title = $('[data-agent-stage]'); if (title) title.textContent = stages[agentStage];
    const feedback = $('[data-agent-feedback]');
    if (feedback) feedback.textContent = [
      '理解任务：明确目标、约束与可用上下文。',
      '制定计划：把目标拆解为可检查的步骤。',
      '调用工具：关键操作需确认。演示不会执行真实操作。',
      '检查结果：验证输出；必要时回到计划阶段。',
      '交付结果：整理输出与执行记录。概念演示结束。'
    ][agentStage];
    const step = $('[data-agent-step]'); if (step) step.textContent = agentStage === 4 ? '再看一次 ↺' : agentStage === 2 ? '模拟确认并继续 →' : '下一步 →';
  }

  function filterProjects(value) {
    let count = 0;
    $$('[data-project-directory] .project-card').forEach(card => {
      card.hidden = value !== 'all' && value !== card.dataset.category;
      if (!card.hidden) count++;
    });
    $$('[data-project-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.projectFilter === value)));
    const output = $('[data-project-count]'); if (output) output.textContent = `${count} 个业务方向`;
  }
  function filterResearchItems() {
    let count = 0;
    const term = ($('[data-research-search]')?.value || '').trim().toLocaleLowerCase();
    $$('[data-research-directory] .research-item').forEach(item => {
      const matchFilter = filterResearch === 'all' || item.dataset.theme === filterResearch;
      const matchSearch = (item.dataset.search || '').toLocaleLowerCase().includes(term);
      item.hidden = !(matchFilter && matchSearch); if (!item.hidden) count++;
    });
    $$('[data-research-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.researchFilter === filterResearch)));
    const empty = $('[data-empty-search]'); if (empty) empty.hidden = count > 0;
    const output = $('[data-research-count]'); if (output) output.textContent = `${count} 个研究方向`;
  }

  // One delegated listener remains valid after single-file preview navigation.
  document.addEventListener('click', async e => {
    const target = e.target instanceof Element ? e.target : null; if (!target) return;
    const routeLink = target.closest('a[data-route]');
    if (routeLink && standalone && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault(); go(routeLink.dataset.route); return;
    }
    if (target.closest('[data-menu-toggle]')) {
      const button = $('[data-menu-toggle]');
      const open = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(open)); $('.site-nav')?.classList.toggle('is-open', open); return;
    }
    if (target.closest('[data-back-top]')) { e.preventDefault(); window.scrollTo({top:0,behavior:paused ? 'instant' : 'smooth'}); main?.focus({preventScroll:true}); return; }
    const tab = target.closest('[data-lab-tab]'); if (tab) { activateTab(tab.dataset.labTab); return; }
    if (target.closest('[data-query-reset]')) { moveQuery(288,154); return; }
    const vector = target.closest('[data-lab-svg="vector"]');
    if (vector) {
      const ctm = vector.getScreenCTM();
      if (ctm) { const p = new DOMPoint(e.clientX,e.clientY).matrixTransform(ctm.inverse()); moveQuery(p.x,p.y); } return;
    }
    if (target.closest('[data-agent-step]')) { agentStage = (agentStage+1)%5; drawAgent(); return; }
    if (target.closest('[data-agent-reset]')) { agentStage = 0; drawAgent(); return; }
    const pf = target.closest('[data-project-filter]'); if (pf) { filterProjects(pf.dataset.projectFilter); return; }
    const rf = target.closest('[data-research-filter]'); if (rf) { filterResearch = rf.dataset.researchFilter; filterResearchItems(); return; }
    if (target.closest('[data-replay]')) { if (!reduced.matches) { paused = false; updateMotionButtons(); startIntro(true); startLoop(); } return; }
    if (target.closest('[data-motion-toggle]')) {
      paused = !paused;
      if (reduced.matches) paused = true;
      try { sessionStorage.setItem('astrmira-motion', paused ? 'paused' : 'active'); } catch (_) {}
      if (paused) { introStart = 0; setPhase('geometry'); }
      updateMotionButtons(); startLoop(); return;
    }
    if (target.closest('[data-copy-brief]') && brief) {
      const status = $('[data-brief-status]');
      try {
        await navigator.clipboard.writeText(brief);
        if (status) status.textContent = '已复制到剪贴板。简报仍未发送。';
      } catch (_) {
        const pre = $('[data-brief-text]');
        const selection = window.getSelection(); const range = document.createRange();
        range.selectNodeContents(pre); selection.removeAllRanges(); selection.addRange(range);
        if (status) status.textContent = '浏览器未允许自动复制。已选中文本，请使用系统复制命令。';
      }
      clearTimeout(copiedTimer); return;
    }
    if (target.closest('[data-download-brief]') && brief) {
      const blob = new Blob([brief], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = 'Astrmira-合作简报.txt'; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1500);
    }
  });
  document.addEventListener('input', e => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    if (t.matches('[data-query-range]')) moveQuery(Number(t.value),queryY);
    if (t.matches('[data-bits-range]')) drawQuant(Number(t.value));
    if (t.matches('[data-research-search]')) filterResearchItems();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const toggle = $('[data-menu-toggle]');
      if (toggle?.getAttribute('aria-expanded') === 'true') {
        toggle.setAttribute('aria-expanded','false'); $('.site-nav')?.classList.remove('is-open'); toggle.focus();
      }
    }
    if (!e.target.matches?.('[data-lab-tab]')) return;
    const keys=['vector','quant','agent']; const i=keys.indexOf(e.target.dataset.labTab);
    const next=e.key==='ArrowRight'?(i+1)%3:e.key==='ArrowLeft'?(i+2)%3:e.key==='Home'?0:e.key==='End'?2:-1;
    if(next>=0){e.preventDefault();activateTab(keys[next],true);}
  });
  document.addEventListener('submit', e => {
    const form=e.target;if(!form.matches?.('[data-brief-form]'))return;
    e.preventDefault(); if(!form.reportValidity())return;
    const data=new FormData(form);
    brief=`Astrmira · 合作简报\n\n称呼：${String(data.get('name')||'未填写').trim()}\n组织 / 团队：${String(data.get('organization')||'未填写').trim()}\n合作方向：${data.get('area')}\n\n问题与目标：\n${String(data.get('problem')||'').trim()}\n\n——\n此简报由网站原型在本地生成，尚未发送。`;
    $('[data-brief-text]').textContent=brief;
    $('[data-brief-result]').hidden=false;
    $('[data-brief-status]').textContent='简报已在本地生成，尚未发送。';
    $('[data-brief-result]').scrollIntoView({behavior:paused?'instant':'smooth',block:'nearest'});
  });

  // Artistic volumetric star: a small, isolated WebGL sphere, not an astronomical simulation.
  function createVolume() {
    const canvas=$('#mira-volume'); if(!canvas)return null;
    const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,powerPreference:'low-power'});
    if(!gl){$('.mira-object').dataset.webgl='false';return null;}
    const vertex=`attribute vec2 a_position;void main(){gl_Position=vec4(a_position,0.0,1.0);}`;
    const fragment=`precision mediump float;
      uniform vec2 u_resolution;uniform float u_time;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.0-2.0*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      float fbm(vec3 p){float v=0.0;float a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.07+1.4;a*=.51;}return v;}
      void main(){vec2 uv=(gl_FragCoord.xy-.5*u_resolution)/u_resolution.y;float d=length(uv);float r=.222;float t=u_time*.085;
        float haze=exp(-d*11.0)*.24;vec3 color=vec3(.77,.59,.34);float alpha=haze;
        if(d<r){float z=sqrt(max(0.0,1.0-dot(uv/r,uv/r)));vec3 n=vec3(uv/r,z);float detail=fbm(n*8.0+vec3(t,t*.8,0.0));float fine=noise(n*49.0+vec3(t*2.0));float light=.46+.54*max(dot(n,normalize(vec3(-.55,.6,.8))),0.0);float hot=smoothstep(.3,.73,detail*.8+fine*.2);color=mix(vec3(.5,.19,.035),vec3(1.0,.84,.51),hot);color*=light;color+=vec3(.35,.17,.04)*pow(1.0-z,2.0);alpha=1.0;}
        else{float angle=atan(uv.y,uv.x);float streak=.5+.5*noise(vec3(cos(angle)*11.0,sin(angle)*11.0,t));float corona=exp(-(d-r)*(49.0+streak*32.0))*(.32+.35*streak);alpha=max(alpha,corona);color=mix(vec3(.44,.58,.74),vec3(.99,.75,.4),corona);}
        alpha*=1.0-smoothstep(.40,.49,d);gl_FragColor=vec4(color,alpha);
      }`;
    const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);return null;}return shader;};
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
    if(!vs||!fs){$('.mira-object').dataset.webgl='false';return null;}
    const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){gl.deleteProgram(program);$('.mira-object').dataset.webgl='false';return null;}
    gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    const resolution=gl.getUniformLocation(program,'u_resolution'),time=gl.getUniformLocation(program,'u_time');
    gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(resolution,canvas.width,canvas.height);
    let lost=false;
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;$('.mira-object').dataset.webgl='false';});
    return elapsed=>{if(lost)return;gl.uniform1f(time,elapsed/1000);gl.drawArrays(gl.TRIANGLES,0,6);};
  }
  let drawVolume = null;
  const companion = $('.mira-object');
  let introStart = 0, phase = 'geometry', raf = 0, lastFrame = 0;
  let starX = innerWidth * .78, starY = innerHeight * .31, targetX = starX, targetY = starY;
  let prevStarX = starX, prevStarY = starY;
  let pointerX = 0, pointerY = 0;
  let mouseX = -9999, mouseY = -9999, mouseVx = 0, mouseVy = 0, lastMouseX = -9999, lastMouseY = -9999;
  let maskRadius = 0, targetMaskRadius = 0, maskX = -9999, maskY = -9999;
  const starCanvas = $('#starfield');
  const starCtx = starCanvas?.getContext('2d');
  let stars = [], textParticles = [], vw = innerWidth, vh = innerHeight;
  const INTRO_DURATION = 2400;

  function seeded(n) {
    let value = n >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  const VAN_GOGH_PALETTE = [
    [214, 184, 129], // #d6b881 warm gold
    [240, 211, 158], // #f0d39e amber yellow
    [141, 171, 195], // #8dabc3 sky cyan
    [82, 123, 159],  // #527b9f deep cobalt
    [197, 167, 120]  // #c5a778 star trail ochre
  ];

  function sampleTextParticles() {
    const hero = $('.hero');
    const copy = $('.hero-copy');
    if (!hero || !copy) { textParticles = []; return; }

    const heroRect = hero.getBoundingClientRect();
    const points = [];
    const step = vw < 720 ? 4 : 3;

    function sampleTextLine(text, style, targetCenterX, targetCenterY, targetRgb, isTitle = false, fontStyleOverride = null) {
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
      offCanvas.width = w;
      offCanvas.height = h;

      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      try { ctx.letterSpacing = letterSpacing; } catch (_) {}
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.fillText(text, pad, h / 2);

      const imgData = ctx.getImageData(0, 0, w, h).data;
      const startX = targetCenterX - textWidth / 2 - pad;
      const startY = targetCenterY - h / 2;

      const isMobile = vw < 720;
      const lineStep = isTitle ? (isMobile ? 3.6 : 2.7) : (fontSize < 18 ? (isMobile ? 1.8 : 1.35) : (isMobile ? 2.2 : 1.6));

      for (let py = 0; py < h; py += lineStep) {
        for (let px = 0; px < w; px += lineStep) {
          const idx = (Math.floor(py) * w + Math.floor(px)) * 4;
          if (imgData[idx + 3] > 80) {
            const relX = startX + px;
            const relY = startY + py;

            const angle = Math.random() * Math.PI * 2;
            const dist = (0.2 + 0.8 * Math.random()) * Math.max(vw, vh) * 0.7;
            const origX = heroRect.left + relX + Math.cos(angle) * dist;
            const origY = heroRect.top + relY + Math.sin(angle) * dist;

            const startColorRgb = VAN_GOGH_PALETTE[Math.floor(Math.random() * VAN_GOGH_PALETTE.length)];
            const radius = isTitle ? (0.85 + Math.random() * 0.95) : (fontSize < 18 ? (0.55 + Math.random() * 0.4) : (0.7 + Math.random() * 0.5));

            points.push({
              relX, relY,
              origX, origY,
              x: origX, y: origY,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              startColorRgb,
              targetColorRgb: targetRgb,
              radius,
              baseAlpha: isTitle ? (0.8 + Math.random() * 0.2) : (0.85 + Math.random() * 0.15),
              glow: 0,
              strokeAngle: angle + Math.PI / 2,
              isTitle
            });
          }
        }
      }
    }

    // 1. Kicker: 幻梦星芒 / ASTR — MIRA
    const kickerEl = $('.hero-kicker');
    if (kickerEl) {
      const r = kickerEl.getBoundingClientRect();
      const style = window.getComputedStyle(kickerEl);
      const cx = r.left - heroRect.left + r.width / 2;
      const cy = r.top - heroRect.top + r.height / 2;
      sampleTextLine('幻梦星芒 / ASTR — MIRA', style, cx, cy, [205, 192, 168], false);
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

    // 3. Subtitle: 于未知处求索，向星穹间开拓。
    const subEl = $('.hero-subtitle');
    if (subEl) {
      const r = subEl.getBoundingClientRect();
      const style = window.getComputedStyle(subEl);
      const cx = r.left - heroRect.left + r.width / 2;
      const cy = r.top - heroRect.top + r.height / 2;
      sampleTextLine('于未知处求索，向星穹间开拓。', style, cx, cy, [250, 248, 243], false);
    }

    // 4. English: From first principles to real-world intelligence.
    const engEl = $('.hero-english');
    if (engEl) {
      const r = engEl.getBoundingClientRect();
      const style = window.getComputedStyle(engEl);
      const cx = r.left - heroRect.left + r.width / 2;
      const cy = r.top - heroRect.top + r.height / 2;
      sampleTextLine('From first principles to real-world intelligence.', style, cx, cy, [172, 179, 193], false, 'italic');
    }

    // 5. Description: 2 lines
    const descEl = $('.hero-description');
    if (descEl) {
      const r = descEl.getBoundingClientRect();
      const style = window.getComputedStyle(descEl);
      const cx = r.left - heroRect.left + r.width / 2;
      const cy1 = (r.top - heroRect.top) + r.height * 0.28;
      const cy2 = (r.top - heroRect.top) + r.height * 0.72;
      sampleTextLine('我们研究数据、计算与智能的底层问题，', style, cx, cy1, [165, 174, 189], false);
      sampleTextLine('让严谨的理论，成为可用的系统。', style, cx, cy2, [165, 174, 189], false);
    }

    textParticles = points;
  }

  function resizeStars() {
    vw = innerWidth; vh = innerHeight;
    if (starCanvas && starCtx) {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      starCanvas.width = Math.round(vw * dpr);
      starCanvas.height = Math.round(vh * dpr);
      starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = seeded(7261);
      stars = Array.from({ length: Math.min(180, Math.round(vw * vh / 10500)) }, () => {
        const ox = rand() * vw, oy = rand() * vh;
        return {
          x: ox, y: oy, origX: ox, origY: oy,
          vx: 0, vy: 0,
          r: 0.35 + rand() * 0.85,
          o: 0.15 + rand() * 0.45,
          p: rand() * 6.28,
          glow: 0,
          strokeLen: 2 + rand() * 5,
          angle: rand() * 6.28
        };
      });
    }
    sampleTextParticles();
    updateStarTarget();
    paintParticlesAndStars(performance.now());
  }

  function setPhase(next) {
    if (!companion) return;
    phase = next; companion.dataset.phase = next;
    const label = $('[data-phase-label]');
    if (label) label.textContent = { volume: '01 / VOLUME', pigment: '02 / PIGMENT', geometry: '03 / GEOMETRY' }[next];
  }

  function updateStarTarget() {
    const hero = $('.hero');
    if (hero) {
      const rect = hero.getBoundingClientRect();
      if (rect.bottom > 130) {
        targetX = vw * (vw < 720 ? .81 : .79);
        targetY = rect.top + rect.height * (vw < 720 ? .245 : .265);
        companion?.classList.remove('is-docked');
        return;
      }
    }
    companion?.classList.add('is-docked');
    targetX = vw - (vw < 720 ? 9 : 34);
    targetY = Math.min(vh * .3, 240);
  }

  function placeStar(immediate = false, now = performance.now()) {
    updateStarTarget();
    let x = targetX + (paused ? 0 : pointerX);
    let y = targetY + (paused ? 0 : pointerY);

    if (introStart) {
      const elapsed = now - introStart;
      if (elapsed < INTRO_DURATION) {
        const t = clamp(elapsed / INTRO_DURATION, 0, 1);
        const u = 1 - Math.pow(1 - t, 3.2);

        // Trajectory: Bottom-left deep space to title right
        const P0 = { x: -60, y: vh * 1.06 };
        const P1 = { x: vw * 0.12, y: vh * 0.60 };
        const P2 = { x: vw * 0.48, y: vh * 0.16 };
        const P3 = { x: targetX, y: targetY };

        const inv = 1 - u;
        x = inv * inv * inv * P0.x + 3 * inv * inv * u * P1.x + 3 * inv * u * u * P2.x + u * u * u * P3.x;
        y = inv * inv * inv * P0.y + 3 * inv * inv * u * P1.y + 3 * inv * u * u * P2.y + u * u * u * P3.y;
      } else {
        introStart = 0;
      }
    }

    if (immediate || paused) { starX = x; starY = y; }
    else { starX += (x - starX) * 0.12; starY += (y - starY) * 0.12; }

    if (companion) {
      companion.style.left = starX.toFixed(2) + 'px';
      companion.style.top = starY.toFixed(2) + 'px';
    }
  }

  function paintParticlesAndStars(now) {
    if (!starCtx) return;
    starCtx.clearRect(0, 0, vw, vh);

    const starVx = starX - prevStarX;
    const starVy = starY - prevStarY;
    prevStarX = starX; prevStarY = starY;

    const hero = $('.hero');
    const heroRect = hero ? hero.getBoundingClientRect() : null;
    const heroLeft = heroRect ? heroRect.left : 0;
    const heroTop = heroRect ? heroRect.top : 0;

    let coalesceT = 1;
    let colorT = 1;
    let introFade = 1.0;
    const copy = $('.hero-copy');
    const textStage = $('.hero-text-stage');

    if (introStart) {
      const elapsed = now - introStart;
      if (elapsed < 380) {
        coalesceT = 0;
      } else {
        const prog = clamp((elapsed - 380) / 1620, 0, 1);
        coalesceT = 1 - Math.pow(1 - prog, 2.8);
      }
      if (elapsed < 1200) {
        colorT = 0;
      } else {
        const cProg = clamp((elapsed - 1200) / 1000, 0, 1);
        colorT = cProg * cProg * (3 - 2 * cProg);
      }
      if (elapsed >= 2200) {
        if (copy && !copy.classList.contains('is-solidified')) {
          copy.classList.add('is-solidified');
        }
        // Smoothly crossfade particles into the crisp solid HTML text
        introFade = clamp(1 - (elapsed - 2200) / 600, 0, 1);
      }
      if (elapsed >= 2800) {
        if (copy && !copy.classList.contains('is-settled')) {
          copy.classList.add('is-settled');
        }
        introStart = 0;
        introFade = 0;
      }
    } else {
      coalesceT = 1;
      colorT = 1;
      introFade = 0;
      if (copy && !copy.classList.contains('is-settled')) {
        copy.classList.add('is-settled');
      }
      if (copy && !copy.classList.contains('is-solidified')) {
        copy.classList.add('is-solidified');
      }
    }
    const isSolidified = copy ? copy.classList.contains('is-solidified') : false;

    if (textStage && isSolidified) {
      const stageRect = textStage.getBoundingClientRect();
      const isNear = (
        mouseX >= stageRect.left - 45 &&
        mouseX <= stageRect.right + 45 &&
        mouseY >= stageRect.top - 35 &&
        mouseY <= stageRect.bottom + 35
      );

      if (isNear) {
        targetMaskRadius = 95;
        maskX = mouseX - stageRect.left;
        maskY = mouseY - stageRect.top;
      } else {
        targetMaskRadius = 0;
      }

      maskRadius += (targetMaskRadius - maskRadius) * (targetMaskRadius > maskRadius ? 0.28 : 0.16);

      if (maskRadius > 0.8) {
        textStage.style.setProperty('--mx', `${maskX.toFixed(1)}px`);
        textStage.style.setProperty('--my', `${maskY.toFixed(1)}px`);
        textStage.style.setProperty('--mr', `${maskRadius.toFixed(1)}px`);
        if (!textStage.classList.contains('is-dissolving')) {
          textStage.classList.add('is-dissolving');
        }
      } else if (textStage.classList.contains('is-dissolving')) {
        textStage.classList.remove('is-dissolving');
      }
    } else if (textStage && textStage.classList.contains('is-dissolving')) {
      textStage.classList.remove('is-dissolving');
    }

    // 1. Paint and perturb ambient background stars
    for (const s of stars) {
      // Star companion wake perturbation
      const sDx = s.x - starX, sDy = s.y - starY;
      const sDist = Math.hypot(sDx, sDy);
      if (sDist < 200 && sDist > 1) {
        const f = 1 - sDist / 200;
        s.vx += (sDx / sDist) * f * 6 + (-sDy / sDist) * f * 4 + starVx * 0.15;
        s.vy += (sDy / sDist) * f * 6 + (sDx / sDist) * f * 4 + starVy * 0.15;
        s.glow = Math.min(1.0, s.glow + f * 1.6);
      }

      // Mouse perturbation
      if (mouseX > -1000) {
        const mDx = s.x - mouseX, mDy = s.y - mouseY;
        const mDist = Math.hypot(mDx, mDy);
        if (mDist < 110 && mDist > 1) {
          const mf = 1 - mDist / 110;
          s.vx += (mDx / mDist) * mf * 5 + mouseVx * 0.12;
          s.vy += (mDy / mDist) * mf * 5 + mouseVy * 0.12;
          s.glow = Math.min(1.0, s.glow + mf * 0.4);
        }
      }

      // Spring back to resting origin
      s.vx += (s.origX - s.x) * 0.04;
      s.vy += (s.origY - s.y) * 0.04;
      s.vx *= 0.85; s.vy *= 0.85;
      s.x += s.vx; s.y += s.vy;
      s.glow *= 0.95;

      const glow = paused ? 1 : (.76 + .24 * Math.sin(now / 3500 + s.p)) + s.glow;
      starCtx.beginPath();
      starCtx.arc(s.x + pointerX * .1, s.y + pointerY * .1, s.r * (1 + s.glow * 0.4), 0, Math.PI * 2);
      starCtx.fillStyle = s.glow > 0.2 ? `rgba(245,225,185,${clamp(s.o * glow, 0, 1)})` : `rgba(175,194,216,${clamp(s.o * glow, 0, 1)})`;
      starCtx.fill();
    }

    // 2. Paint and perturb typography particles
    if (textParticles.length > 0) {
      for (const p of textParticles) {
        // Current home position dynamically anchored to hero element
        const homeX = heroLeft + p.relX;
        const homeY = heroTop + p.relY;
        const distToHome = Math.hypot(p.x - homeX, p.y - homeY);

        // Star wake perturbation during flight
        if (introStart && introFade > 0) {
          const sDx = p.x - starX, sDy = p.y - starY;
          const sDist = Math.hypot(sDx, sDy);
          if (sDist < 180 && sDist > 1) {
            const factor = 1 - sDist / 180;
            p.vx += (sDx / sDist) * factor * 8 + (-sDy / sDist) * factor * 5 + starVx * 0.18;
            p.vy += (sDy / sDist) * factor * 8 + (sDx / sDist) * factor * 5 + starVy * 0.18;
            p.glow = Math.min(1.0, p.glow + factor * 1.8);
          }
        }

        // Mouse perturbation and local proximity disintegration
        let mDist = 9999;
        if (mouseX > -1000) {
          const mDx = p.x - mouseX, mDy = p.y - mouseY;
          mDist = Math.hypot(mDx, mDy);
          const effectiveRadius = isSolidified ? Math.max(maskRadius + 18, 85) : 120;
          if (mDist < effectiveRadius && mDist > 0.5) {
            const mFactor = 1 - mDist / effectiveRadius;
            const push = isSolidified ? mFactor * 9.5 : mFactor * 8;
            const swirl = isSolidified ? mFactor * 6.0 : 0;
            p.vx += (mDx / mDist) * push + (-mDy / mDist) * swirl + mouseVx * 0.22;
            p.vy += (mDy / mDist) * push + (mDx / mDist) * swirl + mouseVy * 0.22;
            p.glow = Math.min(1.0, p.glow + mFactor * 0.85 + Math.hypot(mouseVx, mouseVy) * 0.05);
          }
        }

        // Spring force towards target (interpolating from origX/Y to homeX/Y)
        const targetPosX = p.origX * (1 - coalesceT) + homeX * coalesceT;
        const targetPosY = p.origY * (1 - coalesceT) + homeY * coalesceT;
        const spring = isSolidified ? 0.08 : (0.06 + 0.10 * coalesceT);
        p.vx += (targetPosX - p.x) * spring;
        p.vy += (targetPosY - p.y) * spring;
        p.vx *= 0.80; p.vy *= 0.80;
        p.x += p.vx; p.y += p.vy;
        p.glow *= 0.92;

        // When solidified: Resting particles hidden under crisp HTML text.
        // Render ONLY when dislodged near cursor or returning home!
        if (isSolidified && introFade === 0) {
          if (mDist < (maskRadius + 18) && maskRadius > 1) {
            p.dislodged = true;
          } else if (distToHome < 1.2 && mDist > (maskRadius + 28)) {
            p.dislodged = false;
          }
          if (!p.dislodged) {
            continue;
          }
        }

        // Color interpolation: Van Gogh palette -> Typography target color
        const baseColor = colorT === 0 ? p.startColorRgb : colorT === 1 ? p.targetColorRgb : [
          Math.round(p.startColorRgb[0] + (p.targetColorRgb[0] - p.startColorRgb[0]) * colorT),
          Math.round(p.startColorRgb[1] + (p.targetColorRgb[1] - p.startColorRgb[1]) * colorT),
          Math.round(p.startColorRgb[2] + (p.targetColorRgb[2] - p.startColorRgb[2]) * colorT)
        ];

        let alpha = (p.baseAlpha || 0.7) * (1 + p.glow * 0.4);
        if (isSolidified && introFade === 0) {
          const holeAlpha = maskRadius > 1 && mDist < maskRadius + 20 ? clamp(1 - mDist / (maskRadius + 20), 0, 1) : 0;
          const motionAlpha = clamp(distToHome / 8, 0, 1);
          alpha = clamp(Math.max(holeAlpha, motionAlpha, p.glow) * (0.85 + p.glow * 0.35), 0, 1);
        } else if (introFade < 1.0) {
          alpha *= introFade;
        }

        const colorStr = p.glow > 0.35 ? '#fff6dd' : `rgb(${baseColor[0]},${baseColor[1]},${baseColor[2]})`;
        starCtx.fillStyle = colorStr;
        starCtx.globalAlpha = clamp(alpha, 0, 1);
        starCtx.beginPath();
        starCtx.arc(p.x, p.y, p.radius * (1 + p.glow * 0.35), 0, Math.PI * 2);
        starCtx.fill();

        // Van Gogh directional streak while dispersed or excited
        if (!isSolidified ? (coalesceT < 0.72 || p.glow > 0.25) : (p.glow > 0.15 || distToHome > 3)) {
          const strokeLen = (2.2 + p.glow * 4) * (!isSolidified ? (1 - coalesceT * 0.6) : 1.1);
          if (strokeLen > 0.5) {
            const cos = Math.cos(p.strokeAngle) * strokeLen;
            const sin = Math.sin(p.strokeAngle) * strokeLen;
            starCtx.strokeStyle = colorStr;
            starCtx.lineWidth = p.radius * 0.8;
            starCtx.beginPath();
            starCtx.moveTo(p.x - cos, p.y - sin);
            starCtx.lineTo(p.x + cos, p.y + sin);
            starCtx.stroke();
          }
        }
      }
      starCtx.globalAlpha = 1.0;
    }
  }

  function startIntro(force = false) {
    if (paused || reduced.matches || !$('.hero')) return;
    const copy = $('.hero-copy');
    if (copy) {
      copy.classList.remove('is-settled');
      copy.classList.remove('is-solidified');
    }
    const textStage = $('.hero-text-stage');
    if (textStage) {
      textStage.classList.remove('is-dissolving');
    }
    maskRadius = 0; targetMaskRadius = 0;
    const hero = $('.hero');
    const heroRect = hero ? hero.getBoundingClientRect() : { left: 0, top: 0 };
    // Re-scatter text particles if forced replay
    if (textParticles.length > 0) {
      textParticles.forEach(p => {
        p.dislodged = false;
        if (force) {
          const angle = Math.random() * Math.PI * 2;
          const dist = (0.25 + 0.75 * Math.random()) * Math.max(vw, vh) * 0.7;
          p.origX = heroRect.left + p.relX + Math.cos(angle) * dist;
          p.origY = heroRect.top + p.relY + Math.sin(angle) * dist;
          p.x = p.origX; p.y = p.origY;
          p.vx = (Math.random() - 0.5) * 4;
          p.vy = (Math.random() - 0.5) * 4;
          p.glow = 1.0;
        }
      });
    }
    introStart = performance.now();
    setPhase('pigment');
    placeStar(true, introStart);
  }

  function tick(now) {
    raf = 0;
    if (now - lastFrame >= 1000 / 30) {
      lastFrame = now;
      if (introStart) {
        const elapsed = now - introStart;
        if (elapsed < 1850) {
          if (phase !== 'pigment') setPhase('pigment');
        } else {
          if (phase !== 'geometry') setPhase('geometry');
        }
      }
      placeStar(false, now);
      paintParticlesAndStars(now);
    }
    if (!paused) raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (!document.hidden) {
      if (paused) { paintParticlesAndStars(performance.now()); placeStar(true); }
      else raf = requestAnimationFrame(tick);
    }
  }

  function updateMotionButtons() {
    document.documentElement.classList.toggle('is-paused', paused);
    $$('[data-motion-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(paused));
      button.disabled = reduced.matches;
    });
    $$('[data-motion-text]').forEach(el => el.textContent = reduced.matches ? '已减少动态' : paused ? '启用动效' : '静止动效');
    $$('[data-replay]').forEach(button => button.disabled = reduced.matches);
  }

  window.addEventListener('pointermove', e => {
    if (!finePointer.matches || paused) return;
    pointerX = (e.clientX / vw - .5) * 16;
    pointerY = (e.clientY / vh - .5) * 12;
    if (lastMouseX > -1000) {
      mouseVx = (e.clientX - lastMouseX) * 0.4;
      mouseVy = (e.clientY - lastMouseY) * 0.4;
    }
    mouseX = e.clientX; mouseY = e.clientY;
    lastMouseX = e.clientX; lastMouseY = e.clientY;
  }, { passive: true });

  document.addEventListener('mouseleave', () => {
    mouseX = mouseY = lastMouseX = lastMouseY = -9999;
    mouseVx = mouseVy = 0;
    pointerX = pointerY = 0;
    targetMaskRadius = 0;
  });

  window.addEventListener('scroll', () => {
    if (paused) placeStar(true);
  }, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeStars, 100);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf); raf = 0;
      introStart = 0; setPhase('geometry');
    } else startLoop();
  });

  reduced.addEventListener('change', () => {
    paused = reduced.matches;
    introStart = 0; setPhase('geometry');
    updateMotionButtons(); startLoop();
  });

  resizeStars();
  if (standalone && location.hash.startsWith('#/') && location.hash.length > 2) go(location.hash.slice(2), false);
  else initPage();
  placeStar(true);
  startIntro();
  startLoop();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      sampleTextParticles();
    });
  }
})();
