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
  let drawVolume=null;
  const companion=$('.mira-object');
  let introStart=0,phase='geometry', raf=0,lastFrame=0;
  let starX=innerWidth*.78,starY=innerHeight*.31,targetX=starX,targetY=starY;
  let pointerX=0,pointerY=0;
  const starCanvas=$('#starfield');
  const starCtx=starCanvas?.getContext('2d');
  let stars=[],vw=innerWidth,vh=innerHeight;
  function seeded(n){let value=n>>>0;return()=>{value=(value*1664525+1013904223)>>>0;return value/4294967296;};}
  function resizeStars(){
    vw=innerWidth;vh=innerHeight;
    if(starCanvas&&starCtx){const dpr=Math.min(devicePixelRatio||1,1.5);starCanvas.width=Math.round(vw*dpr);starCanvas.height=Math.round(vh*dpr);starCtx.setTransform(dpr,0,0,dpr,0,0);
      const rand=seeded(7261);stars=Array.from({length:Math.min(180,Math.round(vw*vh/10500))},()=>({x:rand()*vw,y:rand()*vh,r:.3+rand()*.75,o:.12+rand()*.45,p:rand()*6.28}));}
    updateStarTarget();paintStars(performance.now());
  }
  function paintStars(now){
    if(!starCtx)return;starCtx.clearRect(0,0,vw,vh);
    for(const s of stars){const glow=paused?1:.76+.24*Math.sin(now/3500+s.p);starCtx.beginPath();starCtx.arc(s.x+pointerX*.1,s.y+pointerY*.1,s.r,0,Math.PI*2);starCtx.fillStyle=`rgba(175,194,216,${s.o*glow})`;starCtx.fill();}
  }
  function setPhase(next){
    if(!companion)return;phase=next;companion.dataset.phase=next;
    const label=$('[data-phase-label]');if(label)label.textContent={volume:'01 / VOLUME',pigment:'02 / PIGMENT',geometry:'03 / GEOMETRY'}[next];
  }
  function updateStarTarget(){
    const hero=$('.hero');
    if(hero){const rect=hero.getBoundingClientRect();
      if(rect.bottom>130){targetX=vw*(vw<720?.81:.79);targetY=rect.top+rect.height*(vw<720?.245:.265);companion?.classList.remove('is-docked');return;}}
    companion?.classList.add('is-docked');
    // Dock only in the outer margin, never over paragraph text or controls.
    targetX=vw-(vw<720?9:34);targetY=Math.min(vh*.3,240);
  }
  function placeStar(immediate=false,now=performance.now()){
    updateStarTarget();let x=targetX+(paused?0:pointerX),y=targetY+(paused?0:pointerY);
    if(introStart && now-introStart<1200){const t=clamp((now-introStart)/1200,0,1);const smooth=1-Math.pow(1-t,3);x=vw*.22+(targetX-vw*.22)*smooth;y=targetY+Math.sin(t*Math.PI)*-75;}
    if(immediate||paused){starX=x;starY=y;}else{starX+=(x-starX)*.07;starY+=(y-starY)*.07;}
    if(companion){companion.style.left=starX.toFixed(2)+'px';companion.style.top=starY.toFixed(2)+'px';}
  }
  function updateMotionButtons(){
    document.documentElement.classList.toggle('is-paused',paused);
    $$('[data-motion-toggle]').forEach(button=>{button.setAttribute('aria-pressed',String(paused));button.disabled=reduced.matches;});
    $$('[data-motion-text]').forEach(el=>el.textContent=reduced.matches?'已减少动态':paused?'启用动效':'静止动效');
    $$('[data-replay]').forEach(button=>button.disabled=reduced.matches);
  }
  function startIntro(force=false){
    if(paused||reduced.matches||!$('.hero'))return;
    let seen=false;try{seen=sessionStorage.getItem('astrmira-seen')==='1';}catch(_){}
    if(seen&&!force){setPhase('geometry');return;}
    if(!drawVolume)drawVolume=createVolume();
    introStart=performance.now();setPhase('volume');
    if(drawVolume)drawVolume(0);
    try{sessionStorage.setItem('astrmira-seen','1');}catch(_){}
  }
  function tick(now){
    raf=0;if(document.hidden)return;
    if(now-lastFrame>=1000/30){
      lastFrame=now;
      if(introStart){const elapsed=now-introStart;
        if(elapsed<1450){if(phase!=='volume')setPhase('volume');if(drawVolume)drawVolume(elapsed);}
        else if(elapsed<2850){if(phase!=='pigment')setPhase('pigment');}
        else if(elapsed<4600){if(phase!=='geometry')setPhase('geometry');}
        else introStart=0;
      }
      paintStars(now);placeStar(false,now);
    }
    if(!paused)raf=requestAnimationFrame(tick);
  }
  function startLoop(){
    if(raf)cancelAnimationFrame(raf);raf=0;
    if(!document.hidden){if(paused){paintStars(performance.now());placeStar(true);}else raf=requestAnimationFrame(tick);}
  }
  window.addEventListener('pointermove',e=>{if(!finePointer.matches||paused)return;pointerX=(e.clientX/vw-.5)*16;pointerY=(e.clientY/vh-.5)*12;},{passive:true});
  document.addEventListener('mouseleave',()=>{pointerX=pointerY=0;});
  window.addEventListener('scroll',()=>{if(paused)placeStar(true);},{passive:true});
  let resizeTimer;
  window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(resizeStars,100);},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){if(raf)cancelAnimationFrame(raf);raf=0;introStart=0;setPhase('geometry');}else startLoop();});
  reduced.addEventListener('change',()=>{paused=reduced.matches;introStart=0;setPhase('geometry');updateMotionButtons();startLoop();});

  resizeStars();
  if(standalone && location.hash.startsWith('#/') && location.hash.length>2)go(location.hash.slice(2),false);
  else initPage();
  placeStar(true);startIntro();startLoop();
})();
