// Original page-specific choreography; no code imported from the browser extension.
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const layer = $('#swarm-layer'), controls = $('.swarm-controls');
  const status = $('#swarm-status'), replay = $('#replay'), skip = $('#skip');
  const tourButton = $('#tour'), speedButton = $('#speed'), progress = $('.build-progress');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const palette = ['#ff8fce','#b8a0ff','#8be0c5','#ffd18c','#8acbff','#f7a199'];
  const names = ['Layout','Typography','Hardware','Architecture','Pixels','Detail'];
  let jobs = [], agents = [], frame = 0, running = false, tour = false, speed = 1;
  let last = 0, clock = 0, completed = 0, intro = 700, lastStatus = '';
  const point = {x:innerWidth/2,y:innerHeight/2};
  const ease = t => 1-Math.pow(1-t,3);
  function announce(text) { if (text !== lastStatus) { status.textContent=text; lastStatus=text; } }
  function restore(job) {
    job.elements.forEach((el,i)=>{el.style.opacity=job.original[i].opacity;el.style.clipPath=job.original[i].clip;});
    job.texts?.forEach(({node,host})=>host.replaceWith(node));
    job.texts = null;
  }
  function finish() {
    cancelAnimationFrame(frame); frame=0; running=false;
    jobs.forEach(restore); jobs=[]; agents=[]; layer.replaceChildren();
    document.body.classList.remove('swarm-active');
    skip.hidden=true; replay.hidden=false; tour=false;
    tourButton.setAttribute('aria-pressed','false');
    progress.style.width='100%'; announce(reduced.matches?'Reduced motion':'Live · explore');
  }
  function makeJob(elements,kind,duration) {
    const job={elements,kind,duration,state:'pending',original:elements.map(el=>({opacity:el.style.opacity,clip:el.style.clipPath}))};
    elements.forEach(el=>el.style.opacity='0');
    jobs.push(job);
  }
  function prepareText(job) {
    const el=job.elements[0];
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
    job.texts=[];job.chars=[];
    nodes.filter(node=>node.textContent.trim()).forEach(node=>{
      const host=document.createElement('span');
      for(const char of node.textContent){const span=document.createElement('span');span.textContent=char;span.style.opacity='0';span.className='typing-char';span.setAttribute('aria-hidden','true');host.append(span);job.chars.push(span);}
      node.replaceWith(host);const accessible=document.createElement('span');accessible.className='sr-only';accessible.append(node);host.append(accessible);job.texts.push({node,host});
    });
    el.style.opacity=job.original[0].opacity;
  }
  function spawn(i) {
    const cursor=document.createElement('div');cursor.className='cursor';cursor.style.setProperty('--cursor',palette[i]);
    cursor.innerHTML='<svg viewBox="0 0 20 25"><path d="M2 1 L18 16 L10 16 L6 23 Z" fill="currentColor" stroke="#100d19" stroke-width="1.5"/></svg><span>'+names[i]+'</span>';
    const box=document.createElement('div');box.className='build-outline';box.hidden=true;box.style.setProperty('--cursor',palette[i]);
    const label=document.createElement('span');label.className='measurement';box.append(label);
    const gx=document.createElement('div'),gy=document.createElement('div');gx.className='guide-x';gy.className='guide-y';
    [gx,gy].forEach(el=>{el.style.setProperty('--cursor',palette[i]);el.hidden=true;});
    layer.append(cursor,box,gx,gy);
    return {cursor,box,label,gx,gy,x:innerWidth/2,y:innerHeight/2,job:null};
  }
  function bounds(job){
    if(job.kind!=='skyline')return job.elements[0].getBoundingClientRect();
    const rects=job.elements.map(el=>el.getBoundingClientRect());
    const left=Math.min(...rects.map(r=>r.left)),top=Math.min(...rects.map(r=>r.top));
    const right=Math.max(...rects.map(r=>r.right)),bottom=Math.max(...rects.map(r=>r.bottom));
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }
  function eligible(job){const r=bounds(job);return job.state==='pending'&&r.top<innerHeight-65&&r.bottom>0;}
  function start() {
    finish();if(reduced.matches)return;
    running=true;clock=0;last=performance.now();completed=0;progress.style.width='0%';
    replay.hidden=true;skip.hidden=false;document.body.classList.add('swarm-active');
    const rulers=document.createElement('div');rulers.innerHTML='<div class="ruler-top"></div><div class="ruler-left"></div>';layer.append(rulers);
    // Work at text-layer resolution. Keep real links and semantic DOM throughout.
    document.querySelectorAll('main h1,main h2,main h3,main p,main .tags span,main .skills span,main .project-number,main .hero-links a,main .contact>a,main .discipline-strip span,main .console-bar,main .console-bottom').forEach(el=>makeJob([el],'text',Math.min(2200,650+el.textContent.length*12)));
    document.querySelectorAll('.system-art').forEach(el=>makeJob([el],'box',2300));
    // Build the saved SVG in x-ordered columns, preserving its actual data.
    const svg=$('.skyline-art svg');
    const columns=new Map();
    if(svg) [...svg.children].filter(el=>['rect','text'].includes(el.tagName)&&el.getAttribute('width')!=='100%').forEach(el=>{
      const key=Math.floor((Number(el.getAttribute('x'))||0)/40);
      if(!columns.has(key))columns.set(key,[]);columns.get(key).push(el);
    });
    [...columns.entries()].sort((a,b)=>a[0]-b[0]).forEach(([,els])=>makeJob(els.sort((a,b)=>Number(b.getAttribute('y'))-Number(a.getAttribute('y'))),'skyline',950));
    jobs.sort((a,b)=>bounds(a).top-bounds(b).top);
    agents=palette.map((_,i)=>spawn(i));
    announce('Assembling swarm');wake();
  }
  function wake(){if(running&&!frame){last=performance.now();frame=requestAnimationFrame(tick);}}
  function tick(now) {
    frame=0;if(!running)return;
    try {
      const dt=Math.min(250,now-last);last=now;clock+=dt*speed;
      let busy=false;
      agents.forEach((agent,i)=>{
        if(clock>intro&&!agent.job){
          const job=jobs.find(eligible);
          if(job){job.state='active';job.begin=clock;agent.job=job;if(job.kind==='text')prepareText(job);}
        }
        const job=agent.job;
        let tx,ty;
        if(job){
          busy=true;
          const r=bounds(job),p=Math.min(1,(clock-job.begin)/job.duration);
          const draw=Math.min(1,p/.25), reveal=Math.max(0,(p-.25)/.75);
          tx=r.left+r.width*ease(draw);ty=r.top+r.height*ease(draw);
          agent.box.hidden=false;agent.box.classList.toggle('typing',job.kind==='text'&&p>.25);
          Object.assign(agent.box.style,{left:r.left+'px',top:r.top+'px',width:r.width*ease(draw)+'px',height:r.height*ease(draw)+'px'});
          agent.label.textContent=job.kind==='skyline'?'EXTRUDE / CITY':Math.round(r.width*draw)+' × '+Math.round(r.height*draw)+(p<.25?' / DRAW':job.kind==='text'?' / TYPE':' / FILL');
          agent.gx.hidden=agent.gy.hidden=p>.3;
          agent.gx.style.top=r.top+'px';agent.gy.style.left=r.left+'px';
          if(job.kind==='text'){
            const count=Math.floor(reveal*job.chars.length);
            job.chars.forEach((char,j)=>{char.style.opacity=j<count?'1':'0';});
            if(count>0){const caret=job.chars[Math.min(count-1,job.chars.length-1)].getBoundingClientRect();tx=caret.right;ty=caret.bottom;}
          }else if(job.kind==='skyline'){
            job.elements.forEach((el,j)=>{el.style.opacity=reveal>j/job.elements.length?'1':'0';});
            const lit=job.elements[Math.min(job.elements.length-1,Math.floor(reveal*job.elements.length))].getBoundingClientRect();tx=lit.right;ty=lit.top;
          }else{
            job.elements[0].style.opacity='1';job.elements[0].style.clipPath=`inset(${(1-ease(reveal))*100}% 0 0 0)`;
          }
          if(p===1){restore(job);job.state='done';completed++;agent.job=null;agent.box.hidden=agent.gx.hidden=agent.gy.hidden=true;}
        }else{
          // Orbit into position; idle agents gently gather near the pointer.
          const angle=clock/700+i*Math.PI/3;
          tx=point.x+Math.cos(angle)*(45+i*9);ty=point.y+Math.sin(angle)*(30+i*7);
          agent.box.hidden=agent.gx.hidden=agent.gy.hidden=true;
        }
        const follow=1-Math.exp(-dt/90);
        agent.x+=(tx-agent.x)*follow;agent.y+=(ty-agent.y)*follow;
        agent.cursor.style.transform=`translate(${Math.max(8,Math.min(innerWidth-82,agent.x))}px,${Math.max(8,Math.min(innerHeight-85,agent.y))}px)`;
        agent.cursor.style.opacity=job||clock<intro?'1':'.45';
      });
      progress.style.width=(completed/jobs.length*100)+'%';
      if(completed===jobs.length){finish();return;}
      announce(clock<intro?'Assembling swarm':busy?`${completed}/${jobs.length} built`: 'Scroll to build ↓');
      if(tour&&clock>intro&&!busy){
        const next=jobs.find(j=>j.state==='pending');
        if(next){const r=bounds(next);window.scrollBy({top:r.top-100,behavior:'instant'});}
      }
      if(busy||clock<intro||tour)frame=requestAnimationFrame(tick);
    }catch(error){finish();console.error('Rebuild recovered safely',error);}
  }
  replay.addEventListener('click',start);
  skip.addEventListener('click',finish);
  speedButton.addEventListener('click',()=>{speed=speed%3+1;speedButton.textContent=speed+'×';});
  tourButton.addEventListener('click',()=>{if(reduced.matches)return;if(!running)start();tour=!tour;tourButton.setAttribute('aria-pressed',String(tour));wake();});
  document.addEventListener('pointermove',e=>{point.x=e.clientX;point.y=e.clientY;},{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Tab')finish();});
  document.addEventListener('click',e=>{if(running&&e.target.closest('a'))finish();});
  window.addEventListener('scroll',wake,{passive:true});
  // Manual scrolling takes over from Tour, without discarding the build.
  for(const event of ['wheel','touchstart'])window.addEventListener(event,()=>{tour=false;tourButton.setAttribute('aria-pressed','false');},{passive:true});
  window.addEventListener('resize',()=>{if(running)finish();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish();});
  reduced.addEventListener('change',finish);
  const toggle = $('#swarm-toggle'), panel = $('#swarm-panel');
  function setPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  }
  toggle.addEventListener('click', e => setPanel(e.pointerType === 'mouse' ? true : panel.hidden));
  controls.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') setPanel(true); });
  controls.addEventListener('pointerleave', e => {
    if (e.pointerType === 'mouse' && !panel.contains(document.activeElement)) setPanel(false);
  });
  controls.addEventListener('focusin', e => {
    if (e.target.matches(':focus-visible') || panel.contains(e.target)) setPanel(true);
  });
  controls.addEventListener('focusout', () => queueMicrotask(() => {
    if (!controls.contains(document.activeElement) && !controls.matches(':hover')) setPanel(false);
  }));
  document.addEventListener('pointerdown', e => { if (!controls.contains(e.target)) setPanel(false); });
  controls.addEventListener('keydown', e => {
    if (e.key === 'Escape') { toggle.focus(); setPanel(false); }
  });
  controls.hidden=false;
  // Allow layout and fonts to settle before measuring; all content is visible if JS fails.
  document.fonts.ready.then(start);
})();
