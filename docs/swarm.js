// Original, page-specific animation inspired by Swarm. No extension code required.
(() => {
  'use strict';
  const layer = document.querySelector('#swarm-layer');
  const controls = document.querySelector('.swarm-controls');
  const status = document.querySelector('#swarm-status');
  const replay = document.querySelector('#replay');
  const skip = document.querySelector('#skip');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let running = false;
  let jobs = [];
  const colors = ['#ff8fce', '#b8a0ff', '#8be0c5', '#ffd18c'];
  const names = ['layout', 'type', 'systems', 'detail'];

  function finish() {
    cancelAnimationFrame(frame);
    running = false;
    jobs.forEach(({ element, clip }) => { element.style.clipPath = clip; });
    jobs = [];
    layer.replaceChildren();
    skip.hidden = true;
    replay.hidden = false;
    status.textContent = 'Live · explore freely';
  }

  function start() {
    finish();
    if (motion.matches) {
      status.textContent = 'Reduced motion · live';
      return;
    }
    // Rebuild only the viewport: no forced scrolling or hidden off-screen content.
    const elements = [...document.querySelectorAll('[data-build]')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.top < innerHeight - 70 && r.bottom > 0;
    });
    if (!elements.length) return;
    running = true;
    replay.hidden = true;
    skip.hidden = false;
    status.textContent = 'Swarm rebuilding…';
    const cursors = colors.map((color, i) => {
      const cursor = document.createElement('div');
      cursor.className = 'cursor';
      cursor.style.setProperty('--cursor', color);
      cursor.innerHTML = '<svg viewBox="0 0 20 25"><path d="M2 1 L18 16 L10 16 L6 23 Z" fill="currentColor" stroke="#100d19" stroke-width="1.5"/></svg><span>' + names[i] + '</span>';
      layer.append(cursor);
      return cursor;
    });
    jobs = elements.map((element, i) => {
      const outline = document.createElement('div');
      outline.className = 'build-outline';
      outline.style.setProperty('--cursor', colors[i % colors.length]);
      outline.hidden = true;
      layer.append(outline);
      const clip = element.style.clipPath;
      element.style.clipPath = 'inset(0 100% 0 0)';
      return {element, outline, clip, start: Math.floor(i / 4) * 1250 + (i % 4) * 220, duration: 1150, agent: i % 4};
    });
    const begin = performance.now();
    function tick(now) {
      try {
        const elapsed = now - begin;
        let complete = 0;
        const active = new Set();
        jobs.forEach(job => {
          const p = Math.min(1, Math.max(0, (elapsed - job.start) / job.duration));
          const rect = job.element.getBoundingClientRect();
          const eased = 1 - Math.pow(1 - p, 3);
          job.element.style.clipPath = p === 1 ? job.clip : `inset(0 ${(1 - eased) * 100}% 0 0)`;
          job.outline.hidden = p === 0 || p === 1;
          if (p > 0 && p < 1) {
            active.add(job.agent);
            Object.assign(job.outline.style, {left: rect.left + 'px', top: rect.top + 'px', width: rect.width * eased + 'px', height: rect.height + 'px'});
            const x = Math.min(innerWidth - 65, rect.left + rect.width * eased);
            const y = Math.min(innerHeight - 65, Math.max(0, rect.top + rect.height * (.4 + .2 * Math.sin(p * Math.PI))));
            cursors[job.agent].style.transform = `translate(${x}px, ${y}px)`;
          }
          if (p === 1) complete++;
        });
        cursors.forEach((cursor, i) => { cursor.hidden = !active.has(i); });
        if (complete === jobs.length) finish();
        else frame = requestAnimationFrame(tick);
      } catch (error) {
        finish();
        console.error('Swarm animation stopped safely:', error);
      }
    }
    frame = requestAnimationFrame(tick);
  }
  replay.addEventListener('click', start);
  skip.addEventListener('click', finish);
  document.addEventListener('keydown', event => { if (running) finish(); });
  // Immediately restore content when visitors interact or change layout.
  document.addEventListener('click', event => { if (running && !controls.contains(event.target)) finish(); });
  window.addEventListener('resize', () => { if (running) finish(); });
  window.addEventListener('scroll', () => { if (running) finish(); }, {passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  motion.addEventListener('change', finish);
  controls.hidden = false;
  start();
})();
