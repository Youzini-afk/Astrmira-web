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
    prepareHeroTail();
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
    if (target.closest('[data-replay]')) { if (!reduced.matches) { paused = false; updateMotionButtons(); startIntro(); startLoop(); } return; }
    if (target.closest('[data-motion-toggle]')) {
      paused = !paused;
      if (reduced.matches) paused = true;
      try { sessionStorage.setItem('astrmira-motion', paused ? 'paused' : 'active'); } catch (_) {}
      if (paused) introStart = 0;
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
  let heroTail = null;
  let introStart = 0, raf = 0, lastFrame = 0;
  let starX = innerWidth * .78, starY = innerHeight * .31, targetX = starX, targetY = starY;
  let prevStarX = starX, prevStarY = starY;
  let pointerX = 0, pointerY = 0;
  let mouseX = -9999, mouseY = -9999, mouseVx = 0, mouseVy = 0, lastMouseX = -9999, lastMouseY = -9999;
  let maskRadius = 0, targetMaskRadius = 0, maskX = -9999, maskY = -9999, targetMaskX = -9999, targetMaskY = -9999;
  const starCanvas = $('#starfield');
  const starCtx = starCanvas?.getContext('2d');
  let stars = [], textParticles = [], vw = innerWidth, vh = innerHeight;
  let glyphLayers = [];
  let textOriginX = 0, textOriginY = 0;
  let stardustSparks = [];
  let lastPaint = 0;
  const INTRO_DURATION = 4800;
  const smoothstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  function seeded(n) {
    let value = n >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  const VAN_GOGH_PALETTE = [
    [226, 192, 133], // warm luminous gold (#e2c085)
    [248, 220, 160], // amber yellow (#f8dca0)
    [142, 184, 216], // celestial sky cyan (#8eb8d8)
    [72, 122, 168],  // deep impressionist cobalt (#487aa8)
    [206, 172, 120], // star trail ochre (#ceac78)
    [252, 206, 116], // radiant solar flame (#fcce74)
    [108, 156, 196]  // cerulean brushstroke (#6c9cc4)
  ];

  function prepareTextIntro(heroRect) {
    const rand = seeded(1947);
    const titlePoints = textParticles.filter(p => p.isTitle);
    const copyPoints = textParticles.filter(p => !p.isTitle);
    const gathered = [];
    stars.forEach(s => { s.textParticle = null; });
    textParticles.forEach(p => { p.sourceStar = null; });

    // Recruit a minority of the existing sky. The other stars keep their
    // positions and motion throughout the opening, rather than being replaced.
    for (const s of stars) {
      if (!s.gathers) continue;
      const pool = rand() < 0.82 && titlePoints.length ? titlePoints : copyPoints;
      if (!pool.length) continue;
      const p = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      s.textParticle = p;
      p.sourceStar = s;
      p.startRelX = s.x - heroRect.left;
      p.startRelY = s.y - heroRect.top;
      p.delay = 420 + rand() * 1200;
      p.travelDuration = 1650 + rand() * 1050;
      p.bend = (rand() - 0.5) * Math.min(150, Math.hypot(p.relX - p.startRelX, p.relY - p.startRelY) * 0.4);
      gathered.push(p);
    }

    for (const p of textParticles) {
      if (p.sourceStar) continue;
      // Glyph detail develops locally around arriving stars. It never starts
      // as thousands of equally bright specks scattered over the viewport.
      let nearest = null, distance = Infinity;
      for (const guide of gathered) {
        const dx = p.relX - guide.relX, dy = p.relY - guide.relY;
        const d = dx * dx + dy * dy;
        if (d < distance) { distance = d; nearest = guide; }
      }
      const angle = rand() * Math.PI * 2;
      const radius = 5 + rand() * (p.isTitle ? 24 : 10);
      p.startRelX = p.relX + Math.cos(angle) * radius;
      p.startRelY = p.relY + Math.sin(angle) * radius;
      p.travelDuration = 650 + rand() * 400;
      const revealAt = nearest
        ? nearest.delay + nearest.travelDuration * 0.68 + Math.min(Math.sqrt(distance) * 2, 260) + rand() * 240
        : 1900 + rand() * 900;
      p.delay = Math.min(revealAt, INTRO_DURATION - p.travelDuration - 120);
      p.bend = 0;
    }
  }

  function createGlyphLayer(hero, glyph, left, top, width, height, dpr, isTitle, visible) {
    const canvas = document.createElement('canvas');
    canvas.width = glyph.width;
    canvas.height = glyph.height;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.className = 'hero-glyph-surface';
    Object.assign(canvas.style, {
      position: 'absolute', pointerEvents: 'none',
      left: `${left}px`, top: `${top}px`,
      width: `${glyph.width / dpr}px`, height: `${glyph.height / dpr}px`
    });
    const ctx = canvas.getContext('2d');
    const mask = document.createElement('canvas');
    const cellSize = isTitle ? 12 : 6;
    const columns = Math.ceil(width / cellSize) + 1;
    const rows = Math.ceil(height / cellSize) + 1;
    mask.width = columns; mask.height = rows;
    const maskCtx = mask.getContext('2d');
    if (!ctx || !maskCtx) return null;
    const image = maskCtx.createImageData(columns, rows);
    for (let i = 0; i < image.data.length; i += 4) {
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
    }
    const layer = {
      canvas, ctx, glyph, mask, maskCtx, image, dpr, cellSize, columns, rows,
      particles: [], needsPaint: true,
      cells: Array.from({ length: columns * rows }, (_, i) => ({
        x: i % columns, y: Math.floor(i / columns),
        count: 0, sum: 0, alpha: visible ? 1 : 0, source: null
      }))
    };
    hero.append(canvas);
    glyphLayers.push(layer);
    return layer;
  }

  function finishGlyphLayer(layer) {
    const occupied = layer.cells.filter(cell => cell.count);
    // Empty mask cells inherit the nearest stroke, preserving antialiased
    // edges without exposing them before their particles arrive.
    for (const cell of layer.cells) {
      if (cell.count) continue;
      let distance = Infinity;
      for (const candidate of occupied) {
        const d = (candidate.x - cell.x) ** 2 + (candidate.y - cell.y) ** 2;
        if (d < distance) { distance = d; cell.source = candidate; }
      }
    }
  }

  function updateGlyphLayers(heroLeft, heroTop, frameStep) {
    for (const layer of glyphLayers) {
      for (const cell of layer.cells) cell.sum = 0;
      for (const p of layer.particles) {
        const distance = Math.hypot(p.x - heroLeft - p.relX, p.y - heroTop - p.relY);
        const arrival = introStart ? smoothstep((p.introProgress - 0.72) / 0.28) : 1;
        p.glyphCell.sum += arrival * (1 - smoothstep((distance - 1) / 9));
      }
      for (const cell of layer.cells) {
        if (!cell.count) continue;
        const target = cell.sum / cell.count;
        const blend = 1 - Math.exp(-frameStep / (target < cell.alpha ? 4 : 7));
        cell.alpha = paused ? target : cell.alpha + (target - cell.alpha) * blend;
        if (Math.abs(target - cell.alpha) < 0.002) cell.alpha = target;
      }
      let changed = layer.needsPaint;
      for (let i = 0; i < layer.cells.length; i++) {
        const cell = layer.cells[i];
        if (!cell.count) cell.alpha = cell.source?.alpha || 0;
        const alpha = Math.round(cell.alpha * 255);
        const index = i * 4 + 3;
        if (layer.image.data[index] !== alpha) changed = true;
        layer.image.data[index] = alpha;
      }

      // Match the glyph's bilinear mask exactly. Particle opacity is its
      // complement, including while the particle is displaced from its home.
      const alphaAt = (x, y) => layer.image.data[(y * layer.columns + x) * 4 + 3] / 255;
      for (const p of layer.particles) {
        const x = p.glyphX / layer.cellSize, y = p.glyphY / layer.cellSize;
        const ix = Math.floor(x), iy = Math.floor(y);
        const fx = x - ix, fy = y - iy;
        p.glyphBlend = (alphaAt(ix, iy) * (1 - fx) + alphaAt(ix + 1, iy) * fx) * (1 - fy)
          + (alphaAt(ix, iy + 1) * (1 - fx) + alphaAt(ix + 1, iy + 1) * fx) * fy;
      }

      if (!changed) continue;
      layer.maskCtx.putImageData(layer.image, 0, 0);
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      layer.ctx.globalCompositeOperation = 'source-over';
      layer.ctx.drawImage(layer.glyph, 0, 0);
      layer.ctx.globalCompositeOperation = 'destination-in';
      const scale = layer.cellSize * layer.dpr;
      layer.ctx.drawImage(layer.mask, -scale / 2, -scale / 2, layer.columns * scale, layer.rows * scale);
      layer.ctx.globalCompositeOperation = 'source-over';
      layer.needsPaint = false;
    }
  }

  function sampleTextParticles() {
    glyphLayers.forEach(layer => layer.canvas.remove());
    glyphLayers = [];
    const hero = $('.hero');
    const copy = $('.hero-copy');
    if (!hero || !copy) { textParticles = []; return; }

    const isAlreadySolidified = copy.classList.contains('is-solidified');
    const heroRect = hero.getBoundingClientRect();
    textOriginX = heroRect.left;
    textOriginY = heroRect.top;
    const points = [];

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
      // Full glyphs and their particles share one raster at native screen
      // resolution; the viewport star canvas can keep its lighter buffer.
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

      const imgData = ctx.getImageData(0, 0, offCanvas.width, offCanvas.height).data;
      const startX = targetCenterX - textWidth / 2 - pad;
      const startY = targetCenterY - h / 2;
      const glyphLayer = createGlyphLayer(hero, offCanvas, startX, startY, w, h, dpr, isTitle, isAlreadySolidified && !introStart);

      const isMobile = vw < 720;
      const isSmall = fontSize <= 18;
      // Sampling controls the flying particles; the cached glyph keeps the
      // complete strokes once this region has gathered.
      const lineStep = isTitle ? (isMobile ? 2.5 : 1.9) : (isSmall ? (isMobile ? 1.2 : 1.0) : (isMobile ? 1.5 : 1.25));

      for (let py = 0; py < h; py += lineStep) {
        for (let px = 0; px < w; px += lineStep) {
          const idx = (Math.floor(py * dpr) * offCanvas.width + Math.floor(px * dpr)) * 4;
          const pixelAlpha = imgData[idx + 3] / 255;
          if (pixelAlpha > 0.18) {
            const relX = startX + px;
            const relY = startY + py;

            const vanGoghRgb = VAN_GOGH_PALETTE[Math.floor(Math.random() * VAN_GOGH_PALETTE.length)];
            const targetRadius = isTitle ? 1.0 : (isSmall ? 0.65 : 0.82);
            const swirlDir = Math.random() < 0.5 ? -1 : 1;

            const particle = {
              relX, relY,
              x: heroRect.left + relX,
              y: heroRect.top + relY,
              vx: 0, vy: 0,
              vanGoghRgb,
              targetColorRgb: targetRgb,
              targetAlpha: pixelAlpha,
              radius: targetRadius,
              swirlDir,
              baseAlpha: pixelAlpha,
              glow: 0,
              isTitle,
              isSmall,
              settled: isAlreadySolidified,
              dislodged: false,
              dislodgedFactor: 0
            };
            if (glyphLayer) {
              particle.glyphX = px;
              particle.glyphY = py;
              particle.glyphBlend = 0;
              particle.glyphCell = glyphLayer.cells[Math.round(py / glyphLayer.cellSize) * glyphLayer.columns + Math.round(px / glyphLayer.cellSize)];
              particle.glyphCell.count++;
              glyphLayer.particles.push(particle);
            }
            points.push(particle);
          }
        }
      }
      if (glyphLayer) finishGlyphLayer(glyphLayer);
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
    prepareTextIntro(heroRect);
  }

  function resizeStars() {
    vw = innerWidth; vh = innerHeight;
    if (starCanvas && starCtx) {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      starCanvas.width = Math.round(vw * dpr);
      starCanvas.height = Math.round(vh * dpr);
      starCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rand = seeded(7261);
      // Uneven density, mostly faint stars, and a few brighter nearby stars.
      // Density follows viewport area so small screens retain dark space.
      const count = Math.round(vw * vh / 2400);
      stars = Array.from({ length: count }, () => {
        let nx, ny;
        do {
          nx = rand(); ny = rand();
        } while (rand() > 0.48 + 0.32 * Math.exp(-Math.pow((ny - 0.68 + nx * 0.36) / 0.24, 2)));
        const ox = nx * vw, oy = ny * vh;
        const depth = rand();
        const r = 0.35 + Math.pow(depth, 3) * 1.05;
        const o = 0.13 + Math.pow(depth, 2) * 0.62;
        const motion = rand();
        const wander = motion < 0.42 ? 0 : motion < 0.88 ? 2 : 7;
        return {
          x: ox, y: oy, origX: ox, origY: oy,
          vx: 0, vy: 0,
          r, o,
          p: rand() * 6.28,
          wanderSpeed: 0.0015 + rand() * 0.003,
          wanderRadiusX: wander * (0.5 + rand()),
          wanderRadiusY: wander * (0.4 + rand() * 0.6),
          glow: 0,
          depth,
          isGold: rand() > 0.77,
          gathers: rand() < 0.36,
          textParticle: null
        };
      });
    }
    sampleTextParticles();
    prepareHeroTail();
    updateStarTarget();
    paintParticlesAndStars(performance.now());
  }

  function heroStarAnchor(rect) {
    return {
      x: rect.left + rect.width * (vw < 720 ? .81 : .79),
      y: rect.top + rect.height * (vw < 720 ? .245 : .265)
    };
  }

  function prepareHeroTail() {
    const sky = $('.hero-sky');
    const group = $('[data-star-tail]', sky || document);
    const route = $('[data-star-route]', group || document);
    const hero = $('.hero');
    const matrix = sky?.getScreenCTM();
    heroTail = null;
    if (!hero || !group || !route || !matrix) return;
    const length = route.getTotalLength();
    const start = route.getPointAtLength(0);
    const end = route.getPointAtLength(length);
    const rect = hero.getBoundingClientRect();
    const anchor = heroStarAnchor(rect);
    const inverse = matrix.inverse();
    const localStart = new DOMPoint(rect.left - 60, rect.top + rect.height * .9).matrixTransform(inverse);
    const localEnd = new DOMPoint(anchor.x, anchor.y).matrixTransform(inverse);
    const scaleX = (localEnd.x - localStart.x) / (end.x - start.x);
    const scaleY = (localEnd.y - localStart.y) / (end.y - start.y);
    // Fit the original curve between the entry and resting point. This also
    // keeps the flight visible when the SVG's slice viewport becomes narrow.
    group.setAttribute('transform', `translate(${localStart.x - start.x * scaleX} ${localStart.y - start.y * scaleY}) scale(${scaleX} ${scaleY})`);
    $$('path', group).forEach(path => path.setAttribute('pathLength', '1'));
    heroTail = { group, route, length, progress: null };
  }

  function revealHeroTail(progress) {
    if (!heroTail || heroTail.progress === progress) return;
    heroTail.group.setAttribute('stroke-dashoffset', String(1 - progress));
    heroTail.group.setAttribute('opacity', progress > 0 ? '1' : '0');
    heroTail.progress = progress;
  }

  function updateStarTarget() {
    const hero = $('.hero');
    if (hero) {
      const rect = hero.getBoundingClientRect();
      if (rect.bottom > 130) {
        const anchor = heroStarAnchor(rect);
        targetX = anchor.x;
        targetY = anchor.y;
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

    const progress = introStart ? smoothstep((now - introStart - 200) / 3300) : 1;
    revealHeroTail(progress);
    if (introStart && heroTail) {
      // Flight position and the drawn tail share the same arc-length progress.
      const point = heroTail.route.getPointAtLength(heroTail.length * progress);
      const matrix = heroTail.route.getScreenCTM();
      if (matrix) {
        const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        x = screenPoint.x;
        y = screenPoint.y;
      }
    }

    if (immediate || paused) { starX = x; starY = y; }
    else if (introStart) { starX = x; starY = y; }
    else { starX += (x - starX) * 0.12; starY += (y - starY) * 0.12; }

    if (companion) {
      companion.style.left = starX.toFixed(2) + 'px';
      companion.style.top = starY.toFixed(2) + 'px';
    }
  }

  function paintParticlesAndStars(now) {
    if (!starCtx) return;
    const frameStep = lastPaint ? clamp((now - lastPaint) / (1000 / 60), 0, 3) : 1;
    lastPaint = now;
    starCtx.clearRect(0, 0, vw, vh);

    const starVx = starX - prevStarX;
    const starVy = starY - prevStarY;
    prevStarX = starX; prevStarY = starY;

    const hero = $('.hero');
    const heroRect = hero ? hero.getBoundingClientRect() : null;
    const heroLeft = heroRect ? heroRect.left : 0;
    const heroTop = heroRect ? heroRect.top : 0;

    // The canvas is fixed to the viewport; carry text with its hero on scroll,
    // including particles currently displaced by the pointer or intro.
    const textShiftX = heroLeft - textOriginX;
    const textShiftY = heroTop - textOriginY;
    for (const p of textParticles) {
      p.x += textShiftX;
      p.y += textShiftY;
    }
    textOriginX = heroLeft;
    textOriginY = heroTop;

    const copy = $('.hero-copy');
    const introElapsed = introStart ? now - introStart : INTRO_DURATION;
    if (introStart) {
      if (introElapsed > 3500) copy?.classList.add('is-settled');
      if (introElapsed >= INTRO_DURATION) {
        introStart = 0;
        if (copy) {
          if (!copy.classList.contains('is-solidified')) copy.classList.add('is-solidified');
          if (!copy.classList.contains('is-settled')) copy.classList.add('is-settled');
        }
        for (const p of textParticles) {
          p.x = heroLeft + p.relX;
          p.y = heroTop + p.relY;
          p.settled = true;
          p.dislodged = false;
          p.dislodgedFactor = 0;
          p.vx = 0; p.vy = 0;
        }
      }
    } else {
      if (copy && !copy.classList.contains('is-solidified')) {
        copy.classList.add('is-solidified');
        copy.classList.add('is-settled');
      }
    }
    const isSolidified = copy ? copy.classList.contains('is-solidified') : false;

    // Guaranteed settled state when page is solidified and not in intro
    if (isSolidified && !introStart) {
      for (const p of textParticles) {
        if (paused || (!p.dislodged && !p.settled)) {
          p.x = heroLeft + p.relX;
          p.y = heroTop + p.relY;
          p.settled = true;
          p.dislodged = false;
          p.dislodgedFactor = 0;
          p.glow = 0;
          p.vx = 0; p.vy = 0;
        }
      }
    }

    // 1. Persistent sky: still stars, slow drift, and occasional local motion.
    const starMovingSpeed = Math.hypot(starVx, starVy);
    for (const s of stars) {
      if (!paused) {
        s.p += s.wanderSpeed * frameStep;
        const targetWanderX = s.origX + (Math.cos(s.p) + Math.sin(s.p * 1.73) * 0.3) * s.wanderRadiusX;
        const targetWanderY = s.origY + Math.sin(s.p * 0.82 + s.depth) * s.wanderRadiusY;
        s.vx += (targetWanderX - s.x) * 0.008 * frameStep;
        s.vy += (targetWanderY - s.y) * 0.008 * frameStep;
      }

      // Only nearby stars feel the passing companion, with no continuous
      // repulsion once it rests beside the title.
      const sDx = s.x - starX, sDy = s.y - starY;
      const sDist = Math.hypot(sDx, sDy);
      const miraRepelDist = 135;
      if (!paused && starMovingSpeed > 0.15 && sDist < miraRepelDist && sDist > 1) {
        const f = Math.pow(1 - sDist / miraRepelDist, 1.6);
        const push = f * Math.min(starMovingSpeed, 8) * 0.025;
        s.vx += ((sDx - sDy * 0.3) / sDist) * push * frameStep;
        s.vy += ((sDy + sDx * 0.3) / sDist) * push * frameStep;
        s.glow = Math.min(0.35, s.glow + f * 0.025 * frameStep);
      }

      // Cursor perturbation
      if (!paused && mouseX > -1000) {
        const mDx = s.x - mouseX, mDy = s.y - mouseY;
        const mDist = Math.hypot(mDx, mDy);
        if (mDist < 120 && mDist > 1) {
          const mf = Math.pow(1 - mDist / 120, 1.5);
          s.vx += ((mDx / mDist) * mf * 0.12 + mouseVx * mf * 0.008) * frameStep;
          s.vy += ((mDy / mDist) * mf * 0.12 + mouseVy * mf * 0.008) * frameStep;
          s.glow = Math.min(0.35, s.glow + mf * 0.015 * frameStep);
        }
      }

      if (!paused) {
        const damping = Math.pow(0.9, frameStep);
        s.vx *= damping; s.vy *= damping;
        s.x += s.vx * frameStep; s.y += s.vy * frameStep;
        s.glow *= Math.pow(0.96, frameStep);
      }

      // Recruited stars are drawn once, by their moving glyph particle.
      if (hero && s.textParticle) continue;
      const twinkle = paused ? 1 : (0.86 + 0.14 * Math.sin(now / (2600 + s.depth * 3100) + s.p)) + s.glow * 0.3;
      const alpha = clamp(s.o * twinkle, 0, 1);
      starCtx.beginPath();
      starCtx.arc(s.x + pointerX * (0.05 + s.depth * 0.1), s.y + pointerY * (0.05 + s.depth * 0.1), s.r * (1 + s.glow * 0.35), 0, Math.PI * 2);
      starCtx.fillStyle = s.isGold ? `rgba(238, 215, 172, ${alpha})` : `rgba(176, 202, 230, ${alpha})`;
      starCtx.fill();

      if (s.glow > 0.35 || (s.depth > 0.90 && alpha > 0.6)) {
        starCtx.beginPath();
        starCtx.arc(s.x, s.y, s.r * 0.45, 0, Math.PI * 2);
        starCtx.fillStyle = `rgba(255, 252, 240, ${clamp(alpha * 0.95, 0, 1)})`;
        starCtx.fill();
      }
    }

    // Mira star cometary stardust wake trail
    if (!paused && starMovingSpeed > 0.6 && (introStart || !companion?.classList.contains('is-docked'))) {
      const sparkCount = Math.min(3, Math.floor(starMovingSpeed * 0.55) + 1);
      for (let k = 0; k < sparkCount; k++) {
        const spAngle = Math.random() * Math.PI * 2;
        const spDist = Math.random() * 22;
        stardustSparks.push({
          x: starX + Math.cos(spAngle) * spDist,
          y: starY + Math.sin(spAngle) * spDist,
          vx: -starVx * 0.25 + (Math.random() - 0.5) * 2.2,
          vy: -starVy * 0.25 + (Math.random() - 0.5) * 2.2,
          size: 0.8 + Math.random() * 1.3,
          life: 1.0,
          decay: 0.022 + Math.random() * 0.022,
          rgb: VAN_GOGH_PALETTE[Math.floor(Math.random() * VAN_GOGH_PALETTE.length)]
        });
      }
    }

    // 2. Staggered gathering, then direct interaction with the settled text.
    let dislodgedCount = 0;

    if (textParticles.length > 0) {
      for (const p of textParticles) {
        const homeX = heroLeft + p.relX;
        const homeY = heroTop + p.relY;
        const toHomeX = homeX - p.x;
        const toHomeY = homeY - p.y;
        const distToHome = Math.hypot(toHomeX, toHomeY);

        if (!isSolidified) {
          const progress = clamp((introElapsed - p.delay) / p.travelDuration, 0, 1);
          const u = smoothstep(progress);
          p.introProgress = progress;
          const fromX = heroLeft + p.startRelX;
          const fromY = heroTop + p.startRelY;
          const dx = homeX - fromX, dy = homeY - fromY;
          const distance = Math.hypot(dx, dy) || 1;
          const arc = Math.sin(Math.PI * u) * p.bend;
          const drift = p.sourceStar ? Math.sin(introElapsed / 1500 + p.sourceStar.p) * 1.2 * (1 - u) : 0;
          p.x = fromX + dx * u - (dy / distance) * arc + drift;
          p.y = fromY + dy * u + (dx / distance) * arc + drift * 0.5;
          p.vx = 0; p.vy = 0;
          p.glow = 0;
          p.settled = progress === 1;
        } else {
          // Solidified state: direct particle interaction and local disintegration
          let mDist = 9999;
          if (!paused && mouseX > -1000) {
            const mDx = p.x - mouseX;
            const mDy = p.y - mouseY;
            mDist = Math.hypot(mDx, mDy);
            const repelRadius = 82;
            if (mDist < repelRadius && mDist > 0.5) {
              const mF = 1 - mDist / repelRadius;
              p.dislodged = true;
              p.settled = false;
              p.dislodgedFactor = Math.min(1.0, p.dislodgedFactor + 0.32);
              const push = mF * 11.5 + Math.hypot(mouseVx, mouseVy) * 0.22;
              const swirl = mF * 7.0 * p.swirlDir;
              p.vx += (mDx / mDist) * push + (-mDy / mDist) * swirl + mouseVx * 0.24;
              p.vy += (mDy / mDist) * push + (mDx / mDist) * swirl + mouseVy * 0.24;
              p.glow = Math.min(1.0, p.glow + mF * 1.2);
            }
          }

          if (!p.settled) {
            const speed = Math.hypot(p.vx, p.vy);
            // Settle cleanly into exact pixel coordinate
            if (distToHome < 1.4 && (speed < 0.7 || distToHome < 0.7) && mDist > 84) {
              p.x = homeX; p.y = homeY;
              p.vx = 0; p.vy = 0;
              p.settled = true;
              p.dislodged = false;
              p.dislodgedFactor = 0;
              p.glow = 0;
            } else {
              // Cosmic gravity pulling back into letterform
              const pull = Math.min(distToHome * 0.098, 9.2);
              const swirlDistFactor = clamp((distToHome - 8) / 28, 0, 1);
              const swirl = Math.min(distToHome * 0.024, 2.5) * p.swirlDir * swirlDistFactor;
              if (distToHome > 0.3) {
                p.vx += (toHomeX / distToHome) * pull + (-toHomeY / distToHome) * swirl;
                p.vy += (toHomeY / distToHome) * pull + (toHomeX / distToHome) * swirl;
              }
              const damp = distToHome < 12 ? 0.70 : 0.82;
              p.vx *= damp; p.vy *= damp;
              p.x += p.vx; p.y += p.vy;
              p.glow *= 0.91;
              if (mDist > 84) {
                p.dislodgedFactor = Math.max(0, p.dislodgedFactor - 0.04);
              }
            }
          }
        }

        if (!p.settled) {
          dislodgedCount++;
        }
      }
    }

    updateGlyphLayers(heroLeft, heroTop, frameStep);

    // 3. A sparse travelling star becomes a glyph; nearby detail fades in only
    // as it arrives, keeping empty space clear during the opening.
    if (textParticles.length > 0) {
      for (const p of textParticles) {
        const reveal = introStart ? smoothstep(p.introProgress) : 1;
        const arrival = introStart ? smoothstep((p.introProgress - 0.55) / 0.45) : 1;
        let alpha = p.targetAlpha;
        if (introStart) {
          if (p.sourceStar) {
            const s = p.sourceStar;
            const twinkle = 0.86 + 0.14 * Math.sin(now / (2600 + s.depth * 3100) + s.p);
            alpha = s.o * twinkle * (1 - arrival) + p.targetAlpha * arrival;
          } else {
            alpha *= reveal;
          }
        } else if (p.dislodged) {
          alpha = clamp(alpha + p.glow * 0.35, 0, 1);
        }
        if (p.glyphCell) alpha *= 1 - p.glyphBlend;
        if (alpha <= 0.01) continue;

        let rgb;
        if (isSolidified) {
          const f = p.dislodgedFactor;
          rgb = [
            Math.round(p.targetColorRgb[0] + (p.vanGoghRgb[0] - p.targetColorRgb[0]) * f),
            Math.round(p.targetColorRgb[1] + (p.vanGoghRgb[1] - p.targetColorRgb[1]) * f),
            Math.round(p.targetColorRgb[2] + (p.vanGoghRgb[2] - p.targetColorRgb[2]) * f)
          ];
        } else {
          const f = 1 - arrival;
          const starRgb = p.sourceStar?.isGold ? [238, 215, 172] : [176, 202, 230];
          rgb = [
            Math.round(p.targetColorRgb[0] + (starRgb[0] - p.targetColorRgb[0]) * f),
            Math.round(p.targetColorRgb[1] + (starRgb[1] - p.targetColorRgb[1]) * f),
            Math.round(p.targetColorRgb[2] + (starRgb[2] - p.targetColorRgb[2]) * f)
          ];
        }

        // Settled small text retains its dense glyph sampling.
        if (p.settled && p.isSmall) {
          // High-definition subpixel rasterization: 100% crisp typography
          starCtx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(3)})`;
          starCtx.fillRect(p.x - 0.55, p.y - 0.55, 1.1, 1.1);
        } else {
          const startRadius = p.sourceStar ? p.sourceStar.r : p.radius * 0.65;
          const renderRadius = (introStart ? startRadius + (p.radius - startRadius) * arrival : p.radius) * (1 + p.glow * 0.35);

          starCtx.beginPath();
          starCtx.arc(p.x, p.y, renderRadius, 0, Math.PI * 2);
          starCtx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(3)})`;
          starCtx.fill();

          if (p.glow > 0.25 || Math.hypot(p.vx, p.vy) > 1.2) {
            starCtx.beginPath();
            starCtx.arc(p.x, p.y, Math.max(0.4, renderRadius * 0.45), 0, Math.PI * 2);
            starCtx.fillStyle = `rgba(255, 252, 242, ${clamp(alpha * 0.85, 0, 1).toFixed(3)})`;
            starCtx.fill();
          }
        }
      }
    }

    // 4. Stardust emission & rendering on disintegration
    if (!paused && isSolidified && dislodgedCount > 0) {
      const mSpeed = Math.hypot(mouseVx, mouseVy);
      if (mSpeed > 0.6) {
        const count = Math.min(2, Math.floor(mSpeed * 0.5) + 1);
        for (let k = 0; k < count; k++) {
          const spA = Math.random() * Math.PI * 2;
          const spD = Math.random() * 55;
          const spRgb = VAN_GOGH_PALETTE[Math.floor(Math.random() * VAN_GOGH_PALETTE.length)];
          stardustSparks.push({
            x: mouseX + Math.cos(spA) * spD,
            y: mouseY + Math.sin(spA) * spD,
            vx: mouseVx * 0.2 + (Math.random() - 0.5) * 2.5 + (-Math.sin(spA) * 2),
            vy: mouseVy * 0.2 + (Math.random() - 0.5) * 2.5 + (Math.cos(spA) * 2),
            size: 0.6 + Math.random() * 0.8,
            life: 1.0,
            decay: 0.035 + Math.random() * 0.025,
            rgb: spRgb
          });
        }
      }
    }

    if (stardustSparks.length > 0) {
      for (let i = stardustSparks.length - 1; i >= 0; i--) {
        const sp = stardustSparks[i];
        if (!paused) {
          sp.x += sp.vx; sp.y += sp.vy;
          sp.vx *= 0.91; sp.vy *= 0.91;
          sp.life -= sp.decay;
        }
        if (sp.life <= 0) {
          stardustSparks.splice(i, 1);
          continue;
        }
        starCtx.beginPath();
        starCtx.arc(sp.x, sp.y, sp.size * (0.5 + sp.life * 0.5), 0, Math.PI * 2);
        starCtx.fillStyle = `rgba(${sp.rgb[0]},${sp.rgb[1]},${sp.rgb[2]},${clamp(sp.life * 0.9, 0, 1)})`;
        starCtx.fill();
      }
    }
    if (!paused) {
      mouseVx *= Math.pow(0.86, frameStep);
      mouseVy *= Math.pow(0.86, frameStep);
    }
  }

  function startIntro() {
    if (paused || reduced.matches || !$('.hero')) return;
    const copy = $('.hero-copy');
    if (copy) {
      copy.classList.remove('is-settled');
      copy.classList.remove('is-solidified');
    }
    const textStage = $('.hero-text-stage');
    if (textStage) {
      textStage.classList.remove('is-dissolving');
      textStage.style.removeProperty('--stage-opacity');
      textStage.style.removeProperty('--mr');
      textStage.style.removeProperty('--mx');
      textStage.style.removeProperty('--my');
    }
    maskRadius = 0; targetMaskRadius = 0;
    stardustSparks = [];
    for (const layer of glyphLayers) {
      layer.cells.forEach(cell => { cell.alpha = 0; });
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      layer.needsPaint = true;
    }
    const hero = $('.hero');
    const heroRect = hero ? hero.getBoundingClientRect() : { left: 0, top: 0 };
    textOriginX = heroRect.left;
    textOriginY = heroRect.top;
    prepareTextIntro(heroRect);
    if (textParticles.length > 0) {
      textParticles.forEach(p => {
        p.settled = false;
        p.dislodged = false;
        p.dislodgedFactor = 0;
        p.x = heroRect.left + p.startRelX;
        p.y = heroRect.top + p.startRelY;
        p.introProgress = 0;
        p.vx = 0; p.vy = 0;
        p.glow = 0;
      });
    }
    introStart = performance.now();
    placeStar(true, introStart);
    prevStarX = starX;
    prevStarY = starY;
  }

  function tick(now) {
    raf = 0;
    if (now - lastFrame >= 1000 / 60) {
      lastFrame = now;
      placeStar(false, now);
      paintParticlesAndStars(now);
    }
    if (!paused) raf = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (!document.hidden) {
      if (paused) { placeStar(true); paintParticlesAndStars(performance.now()); }
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
    if (paused) {
      placeStar(true);
      paintParticlesAndStars(performance.now());
    }
  }, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeStars, 100);
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (raf) cancelAnimationFrame(raf); raf = 0;
      introStart = 0;
    } else startLoop();
  });

  reduced.addEventListener('change', () => {
    paused = reduced.matches;
    introStart = 0;
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
      if (!introStart) sampleTextParticles();
    });
  }
})();
